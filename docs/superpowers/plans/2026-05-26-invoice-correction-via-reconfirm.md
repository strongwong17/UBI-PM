# Invoice Correction via Re-confirm + Percentage-Aware Generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make invoice line totals — including percentage-basis lines (e.g. 10%-of-incentives, 15%-of-subtotal) — derive from confirmed delivered quantities through one shared resolver, and let an ADMIN correct an issued unpaid invoice by reopening it to the Delivery & Sign-off confirm stage and regenerating the same invoice in place.

**Architecture:** Extract the estimate builder's percentage-resolution logic into a pure shared module (`estimate-totals.ts`), used by the estimate builder (unchanged behavior), the project/billing total displays, and a new invoice-generation helper (`invoice-from-estimate.ts`) that bills off `deliveredQuantity`. Invoice generation and a new ADMIN regenerate endpoint both use that helper. The invoice page gains an admin "Reopen for correction" button; the Delivery & Sign-off tab handles a `correctInvoice` URL param to regenerate the existing invoice instead of creating a new one. The superseded manual-edit work (extended line editor + `InvoiceCorrectionShell`) is reverted.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (PostgreSQL via `@prisma/adapter-pg`), NextAuth v5, Sonner, Tailwind + shadcn/ui. No automated test framework — each task ends with `npm run build` (type-check) + a manual smoke check, then a commit.

**Reference spec:** `docs/superpowers/specs/2026-05-26-invoice-correction-via-reconfirm-design.md`

---

## File Structure

**Create:**
- `src/lib/estimate-totals.ts` — pure, client+server-safe percentage-aware total resolver (`resolveLineTotal`, `phaseTotal`, `plannedQty`, `deliveredQty`, `BillingLine`/`BillingPhase` types).
- `src/lib/estimate-billing.ts` — server adapter: maps a Prisma estimate (`phases → lineItems`) to `BillingPhase[]` (resolving `basisLineItemDesc → id`), plus `estimateSubtotal(estimate, getQty)`.
- `src/lib/invoice-from-estimate.ts` — `buildInvoiceFromEstimate(estimate, opts)` → invoice line items + totals, billed off `deliveredQuantity`. Shared by invoice POST (SLICE) and the regenerate endpoint.
- `src/app/api/projects/[id]/invoices/[invoiceId]/regenerate/route.ts` — ADMIN-only POST that regenerates an existing invoice in place.
- `src/components/invoices/reopen-correction-button.tsx` — client button: PATCH status→DRAFT, navigate to the confirm stage.

**Modify:**
- `src/components/estimates/estimate-builder.tsx` — replace local `resolveItemTotal`/`phaseTotal` with thin adapters over `estimate-totals.ts` (behavior-preserving).
- `src/lib/billing.ts` — `computeBillingState` uses `estimateSubtotal` (planned + delivered selectors) instead of flat qty×price.
- `src/app/(dashboard)/projects/[id]/page.tsx` — `estimateTotal()` helper uses `estimateSubtotal` (planned selector).
- `src/app/api/projects/[id]/invoices/route.ts` — SLICE mode builds lines via `buildInvoiceFromEstimate` (sources `deliveredQuantity`; drops the `lines[]` requirement).
- `src/components/projects/delivery-signoff-tab.tsx` — stop sending `lines[]`; handle `?correctInvoice=` (banner + "Save & regenerate" → regenerate endpoint).
- `src/app/(dashboard)/invoices/[id]/page.tsx` — remove `InvoiceCorrectionShell` wiring (restore read-only non-DRAFT blocks), keep `isAdmin`, add `ReopenCorrectionButton`.
- `src/components/invoices/invoice-line-editor.tsx` — revert to quantity + discount only.

**Delete:**
- `src/components/invoices/invoice-correction-shell.tsx`.

**No changes / retained:** `src/app/api/invoices/[id]/route.ts` (Task-2 admin gate + Task-3 activity diff stay), `prisma/schema.prisma` (no migration), the PDF redesign files.

---

## Task 1: Shared percentage-aware resolver + estimate-builder refactor (behavior-preserving)

**Files:**
- Create: `src/lib/estimate-totals.ts`
- Modify: `src/components/estimates/estimate-builder.tsx`

**Why:** Today `resolveItemTotal`/`phaseTotal` live inside `estimate-builder.tsx` (lines ~138-202) and are the only correct implementation of percentage-basis resolution. Extract them to a pure module so invoice generation and billing can reuse the exact same logic. The only generalization is a `getQuantity` selector (planned vs delivered) and matching the LINE_ITEM basis by a normalized `id`.

- [ ] **Step 1: Create the pure resolver module**

Create `src/lib/estimate-totals.ts`:

```ts
// Pure, client+server-safe resolution of estimate/invoice line totals,
// including percentage-basis lines. Mirrors the original resolveItemTotal
// from estimate-builder.tsx, generalized over a quantity selector and an
// id-based LINE_ITEM reference.

export interface BillingLine {
  id: string;
  quantity: number;
  unitPrice: number;
  deliveredQuantity?: number | null;
  /** "" | null = fixed; otherwise "SUBTOTAL" | "PHASE" | "LINE_ITEM" */
  percentageBasis?: string | null;
  percentageRate?: number | null;
  basisPhaseName?: string | null;
  /** Normalized reference to another BillingLine.id (for LINE_ITEM basis). */
  basisLineItemId?: string | null;
}

export interface BillingPhase {
  name: string;
  lines: BillingLine[];
}

export type QuantitySelector = (line: BillingLine) => number;

export const plannedQty: QuantitySelector = (l) => l.quantity;
export const deliveredQty: QuantitySelector = (l) => l.deliveredQuantity ?? 0;

/**
 * Resolve the total for a single line, handling percentage mode.
 *  - SUBTOTAL: rate × (all fixed + resolved PHASE/LINE_ITEM lines), excluding other SUBTOTAL lines.
 *  - PHASE: rate × (fixed + PHASE/LINE_ITEM lines within the named phase), excluding SUBTOTAL lines.
 *  - LINE_ITEM: rate × (resolved value of the referenced line).
 */
export function resolveLineTotal(
  line: BillingLine,
  phases: BillingPhase[],
  getQty: QuantitySelector
): number {
  if (!line.percentageBasis) return getQty(line) * line.unitPrice;

  const rate = (line.percentageRate || 0) / 100;

  if (line.percentageBasis === "SUBTOTAL") {
    let basis = 0;
    for (const p of phases) {
      for (const item of p.lines) {
        if (item.id === line.id) continue;
        if (!item.percentageBasis) {
          basis += getQty(item) * item.unitPrice;
        } else if (item.percentageBasis !== "SUBTOTAL") {
          basis += resolveLineTotal(item, phases, getQty);
        }
      }
    }
    return basis * rate;
  }

  if (line.percentageBasis === "PHASE") {
    const target = phases.find(
      (p) => p.name.trim() !== "" && p.name.trim() === (line.basisPhaseName ?? "").trim()
    );
    if (!target) return 0;
    let basis = 0;
    for (const item of target.lines) {
      if (item.id === line.id) continue;
      if (!item.percentageBasis) {
        basis += getQty(item) * item.unitPrice;
      } else if (item.percentageBasis !== "SUBTOTAL") {
        basis += resolveLineTotal(item, phases, getQty);
      }
    }
    return basis * rate;
  }

  if (line.percentageBasis === "LINE_ITEM") {
    for (const p of phases) {
      const target = p.lines.find((item) => item.id === line.basisLineItemId);
      if (target) {
        const basis = !target.percentageBasis
          ? getQty(target) * target.unitPrice
          : resolveLineTotal(target, phases, getQty);
        return basis * rate;
      }
    }
    return 0;
  }

  return 0;
}

export function phaseTotal(
  phase: BillingPhase,
  phases: BillingPhase[],
  getQty: QuantitySelector
): number {
  return phase.lines.reduce((sum, l) => sum + resolveLineTotal(l, phases, getQty), 0);
}
```

- [ ] **Step 2: Refactor `estimate-builder.tsx` to delegate to the shared module**

Open `src/components/estimates/estimate-builder.tsx`. Add this import alongside the other imports near the top of the file:

```ts
import {
  resolveLineTotal as resolveSharedLineTotal,
  type BillingPhase as SharedBillingPhase,
} from "@/lib/estimate-totals";
```

Then locate the existing block (the doc comment + `function resolveItemTotal(li: LineItem, allPhases: Phase[]): number { … }` + `function phaseTotal(phase: Phase, allPhases: Phase[]) { … }`, currently around lines 138-202) and **replace that entire block** with the following adapters. They map the builder's client shapes (which use `_key` as identity and `basisLineItemKey` as the LINE_ITEM reference) into the shared `BillingPhase`/`BillingLine` shape and call the shared resolver with the planned-quantity selector — preserving current behavior exactly.

```ts
/** Map the builder's client phases into the shared BillingPhase shape.
 *  Identity = `_key`; LINE_ITEM reference = `basisLineItemKey`. */
function toSharedPhases(allPhases: Phase[]): SharedBillingPhase[] {
  return allPhases.map((p) => ({
    name: p.name,
    lines: p.lineItems.map((li) => ({
      id: li._key,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      percentageBasis: li.percentageBasis || null,
      percentageRate: li.percentageRate,
      basisPhaseName: li.basisPhaseName,
      basisLineItemId: li.basisLineItemKey || null,
    })),
  }));
}

/** Resolve one line's total (planned quantities), via the shared resolver. */
function resolveItemTotal(li: LineItem, allPhases: Phase[]): number {
  const shared = toSharedPhases(allPhases);
  const self = {
    id: li._key,
    quantity: li.quantity,
    unitPrice: li.unitPrice,
    percentageBasis: li.percentageBasis || null,
    percentageRate: li.percentageRate,
    basisPhaseName: li.basisPhaseName,
    basisLineItemId: li.basisLineItemKey || null,
  };
  return resolveSharedLineTotal(self, shared, (l) => l.quantity);
}

function phaseTotal(phase: Phase, allPhases: Phase[]) {
  return phase.lineItems.reduce((sum, li) => sum + resolveItemTotal(li, allPhases), 0);
}
```

Leave all call sites of `resolveItemTotal` / `phaseTotal` unchanged — their signatures are identical.

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 4: Manual parity smoke**

Start `npm run dev`, open an existing estimate that uses a percentage line (SUBTOTAL% or LINE_ITEM%) in the estimate builder, and confirm the per-phase totals and grand total are **identical** to before this change. (If you have no such estimate, create a throwaway one with a fixed line + a 15%-SUBTOTAL line and confirm the 15% line shows 15% of the fixed line.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/estimate-totals.ts src/components/estimates/estimate-builder.tsx
git commit -m "refactor(estimates): extract percentage-aware total resolver to shared lib"
```

---

## Task 2: Route server-side estimate totals through the shared resolver

**Files:**
- Create: `src/lib/estimate-billing.ts`
- Modify: `src/lib/billing.ts`
- Modify: `src/app/(dashboard)/projects/[id]/page.tsx`

**Why:** `computeBillingState` (`billing.ts:34-37`) and the project page's `estimateTotal()` (`page.tsx:79-90`) both sum line totals as flat `quantity × unitPrice`, ignoring percentage lines. With Task 1 done we can make them consistent with the builder (and with invoices, Task 3). This is the "single source of truth for line totals" goal.

- [ ] **Step 1: Create the server adapter**

Create `src/lib/estimate-billing.ts`:

```ts
import { resolveLineTotal, type BillingPhase, type QuantitySelector } from "@/lib/estimate-totals";

/** Minimal shape we need off a Prisma estimate's phases/lineItems. */
interface EstimateLineLike {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  deliveredQuantity: number | null;
  percentageBasis: string | null;
  percentageRate: number | null;
  basisPhaseName: string | null;
  basisLineItemDesc: string | null;
}
interface EstimatePhaseLike {
  name: string;
  lineItems: EstimateLineLike[];
}
export interface EstimateForBilling {
  phases: EstimatePhaseLike[];
}

/** Map a Prisma estimate into shared BillingPhase[], resolving the LINE_ITEM
 *  reference from description (basisLineItemDesc) to the target line's id. */
export function mapEstimateToBillingPhases(estimate: EstimateForBilling): BillingPhase[] {
  const idByDesc = new Map<string, string>();
  for (const p of estimate.phases) {
    for (const li of p.lineItems) {
      if (!idByDesc.has(li.description)) idByDesc.set(li.description, li.id);
    }
  }
  return estimate.phases.map((p) => ({
    name: p.name,
    lines: p.lineItems.map((li) => ({
      id: li.id,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      deliveredQuantity: li.deliveredQuantity,
      percentageBasis: li.percentageBasis || null,
      percentageRate: li.percentageRate,
      basisPhaseName: li.basisPhaseName,
      basisLineItemId:
        li.percentageBasis === "LINE_ITEM" && li.basisLineItemDesc
          ? idByDesc.get(li.basisLineItemDesc) ?? null
          : null,
    })),
  }));
}

/** Sum of resolved line totals for an estimate, under the given quantity selector. */
export function estimateSubtotal(estimate: EstimateForBilling, getQty: QuantitySelector): number {
  const phases = mapEstimateToBillingPhases(estimate);
  return phases.reduce(
    (s, ph) => s + ph.lines.reduce((ss, l) => ss + resolveLineTotal(l, phases, getQty), 0),
    0
  );
}
```

- [ ] **Step 2: Use it in `computeBillingState`**

In `src/lib/billing.ts`, add the import at the top:

```ts
import { estimateSubtotal } from "@/lib/estimate-billing";
import { plannedQty, deliveredQty } from "@/lib/estimate-totals";
```

Replace the inner accumulation loop (currently):

```ts
  for (const est of project.estimates) {
    if (!est.isApproved) continue;
    if (est.parentEstimateId) continue; // skip RMB duplicates
    if (est.currency !== primaryCurrency) continue;
    for (const phase of est.phases) {
      for (const li of phase.lineItems) {
        estimated += li.quantity * li.unitPrice;
        delivered += (li.deliveredQuantity ?? 0) * li.unitPrice;
      }
    }
  }
```

with:

```ts
  for (const est of project.estimates) {
    if (!est.isApproved) continue;
    if (est.parentEstimateId) continue; // skip RMB duplicates
    if (est.currency !== primaryCurrency) continue;
    estimated += estimateSubtotal(est, plannedQty);
    delivered += estimateSubtotal(est, deliveredQty);
  }
```

(The `ProjectForBilling` type already includes `phases.lineItems`; the percentage fields and `deliveredQuantity` are scalar columns and are included automatically.)

- [ ] **Step 3: Use it in the project page's `estimateTotal()`**

In `src/app/(dashboard)/projects/[id]/page.tsx`, add the import near the other `@/lib` imports:

```ts
import { estimateSubtotal } from "@/lib/estimate-billing";
import { plannedQty } from "@/lib/estimate-totals";
```

Find the `estimateTotal()` helper (around lines 79-90). Replace its `subtotal` computation so it uses the resolver. The current shape is:

```ts
  function estimateTotal(estimate: NonNullable<typeof project>["estimates"][0]) {
    const subtotal = estimate.phases.reduce(
      (s, p) => s + p.lineItems.reduce((ss, l) => ss + l.quantity * l.unitPrice, 0),
      0
    );
    const discount = estimate.discount ?? 0;
    const taxRate = estimate.taxRate ?? 0;
    // …existing tax/total math…
  }
```

Replace **only** the `subtotal` line with:

```ts
    const subtotal = estimateSubtotal(estimate, plannedQty);
```

Leave the discount/tax/total math below it unchanged.

- [ ] **Step 4: Type-check**

Run: `npm run build`
Expected: clean build. If TypeScript complains that the estimate argument doesn't satisfy `EstimateForBilling`, confirm the page/billing query includes `phases.lineItems` (it does) — the structural type only requires the listed fields, which are all present.

- [ ] **Step 5: Manual smoke**

On a project whose approved estimate has a percentage line, open the project: the "Estimated" figure in the Invoices-tab billing summary and the estimate total on the Estimates tab should now both include the resolved percentage amount (and agree with each other and with the estimate builder).

- [ ] **Step 6: Commit**

```bash
git add src/lib/estimate-billing.ts src/lib/billing.ts "src/app/(dashboard)/projects/[id]/page.tsx"
git commit -m "feat(billing): resolve percentage lines in billing state and project estimate totals"
```

---

## Task 3: Percentage-aware invoice generation (SLICE)

**Files:**
- Create: `src/lib/invoice-from-estimate.ts`
- Modify: `src/app/api/projects/[id]/invoices/route.ts`

**Why:** SLICE generation currently flattens every line to `quantity × unitPrice` from a passed `lines[]` payload and never re-derives percentage lines. Build invoice lines from the estimate tree + persisted `deliveredQuantity`, emitting both measured lines and resolved percentage lines, in one helper reused by the regenerate endpoint (Task 4).

- [ ] **Step 1: Create the shared invoice-build helper**

Create `src/lib/invoice-from-estimate.ts`:

```ts
import { resolveLineTotal, deliveredQty } from "@/lib/estimate-totals";
import { mapEstimateToBillingPhases } from "@/lib/estimate-billing";

interface EstLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  deliveredQuantity: number | null;
  percentageBasis: string | null;
  percentageRate: number | null;
  basisPhaseName: string | null;
  basisLineItemDesc: string | null;
}
interface EstPhase {
  name: string;
  lineItems: EstLine[];
}
export interface EstimateForInvoice {
  phases: EstPhase[];
  taxRate: number;
  discount: number;
}

export interface BuiltInvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sortOrder: number;
  estimateLineItemId: string | null;
}
export interface BuiltInvoice {
  lineItems: BuiltInvoiceLine[];
  subtotal: number;
  taxRate: number;
  tax: number;
  discount: number;
  total: number;
}

/**
 * Build invoice line items + totals from an estimate, billing measured lines at
 * their confirmed deliveredQuantity and emitting percentage lines at their
 * resolved value (off the delivered bases). Lines resolving to <= 0 are skipped.
 */
export function buildInvoiceFromEstimate(
  estimate: EstimateForInvoice,
  opts?: { taxRate?: number; discount?: number }
): BuiltInvoice {
  const phases = mapEstimateToBillingPhases(estimate);
  const lineItems: BuiltInvoiceLine[] = [];
  let sortOrder = 0;

  for (let pi = 0; pi < estimate.phases.length; pi++) {
    const srcPhase = estimate.phases[pi];
    const bPhase = phases[pi];
    for (let li = 0; li < srcPhase.lineItems.length; li++) {
      const src = srcPhase.lineItems[li];
      const bLine = bPhase.lines[li];
      const total = resolveLineTotal(bLine, phases, deliveredQty);
      if (total <= 0) continue;
      if (src.percentageBasis) {
        // Derived line: represent as qty 1 × resolved total.
        lineItems.push({
          description: src.description,
          quantity: 1,
          unitPrice: total,
          total,
          sortOrder: sortOrder++,
          estimateLineItemId: src.id,
        });
      } else {
        const q = src.deliveredQuantity ?? 0;
        lineItems.push({
          description: src.description,
          quantity: q,
          unitPrice: src.unitPrice,
          total: q * src.unitPrice,
          sortOrder: sortOrder++,
          estimateLineItemId: src.id,
        });
      }
    }
  }

  const subtotal = lineItems.reduce((s, l) => s + l.total, 0);
  const taxRate = opts?.taxRate ?? estimate.taxRate;
  const discount = opts?.discount ?? estimate.discount;
  const taxable = subtotal - discount;
  const tax = taxable * (taxRate / 100);
  const total = taxable + tax;

  return { lineItems, subtotal, taxRate, tax, discount, total };
}
```

- [ ] **Step 2: Use it in the SLICE branch of `POST /api/projects/[id]/invoices`**

In `src/app/api/projects/[id]/invoices/route.ts`, add the import:

```ts
import { buildInvoiceFromEstimate } from "@/lib/invoice-from-estimate";
```

Replace the entire `if (mode === "SLICE") { … }` block (currently lines ~76-99, which validates `lines` and loops over them) with:

```ts
    if (mode === "SLICE") {
      // Bill from the estimate's confirmed delivered quantities. Percentage
      // lines (e.g. 10% of incentives, 15% of subtotal) are re-derived here.
      const built = buildInvoiceFromEstimate(estimate);
      if (built.lineItems.length === 0) {
        return NextResponse.json(
          { error: "No billable lines (nothing delivered)" },
          { status: 400 }
        );
      }
      invoiceLines.push(...built.lineItems);
    } else if (mode === "PERCENT") {
```

(Keep the existing PERCENT and FLAT branches exactly as they are — this edit only changes the SLICE branch and rewires the `else if (mode === "PERCENT")` that follows. The totals block at lines ~135-140 already recomputes `subtotal`/`tax`/`total` from `invoiceLines` and `estimate.taxRate`/`estimate.discount`, matching `buildInvoiceFromEstimate`'s formula, so leave it unchanged.)

The `lines` field in the request body is now unused for SLICE. Leave the destructure as-is (harmless); the Delivery & Sign-off tab stops sending it in Task 5.

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 4: Manual smoke**

On a project whose approved estimate has a 10%-of-incentives line and a measured Incentives line: on the Delivery & Sign-off tab, set the delivered incentive quantity below planned, click "Confirm & generate draft invoice". Open the draft invoice and verify (a) the measured line bills at the delivered quantity, and (b) the 10% line equals 10% of the *delivered* incentive amount (not the planned amount), and any 15%-of-subtotal line reflects the new subtotal.

- [ ] **Step 5: Commit**

```bash
git add src/lib/invoice-from-estimate.ts "src/app/api/projects/[id]/invoices/route.ts"
git commit -m "feat(invoices): bill SLICE invoices off delivered actuals with re-derived percentage lines"
```

---

## Task 4: Regenerate endpoint (updates the same invoice in place)

**Files:**
- Create: `src/app/api/projects/[id]/invoices/[invoiceId]/regenerate/route.ts`

**Why:** Reopening an issued invoice for correction needs to recompute its lines/totals from the (re-confirmed) actuals and write them back to the **same** invoice record, ADMIN-only.

- [ ] **Step 1: Write the route**

Create `src/app/api/projects/[id]/invoices/[invoiceId]/regenerate/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { buildInvoiceFromEstimate } from "@/lib/invoice-from-estimate";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  try {
    const authResult = await requireAuth(["ADMIN"]);
    if (isAuthError(authResult)) return authResult;
    const { userId } = authResult;

    const { id, invoiceId } = await params;

    const existing = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!existing || existing.projectId !== id) {
      return NextResponse.json({ error: "Invoice not found for this project" }, { status: 404 });
    }
    if (existing.status === "PAID") {
      return NextResponse.json(
        { error: "Cannot regenerate a paid invoice. Change its status first." },
        { status: 400 }
      );
    }
    if (!existing.estimateId) {
      return NextResponse.json(
        { error: "Invoice has no source estimate to regenerate from" },
        { status: 400 }
      );
    }

    const estimate = await prisma.estimate.findUnique({
      where: { id: existing.estimateId },
      include: {
        phases: {
          include: { lineItems: { orderBy: { sortOrder: "asc" } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (!estimate) {
      return NextResponse.json({ error: "Source estimate not found" }, { status: 404 });
    }

    const built = buildInvoiceFromEstimate(estimate);
    if (built.lineItems.length === 0) {
      return NextResponse.json(
        { error: "No billable lines (nothing delivered)" },
        { status: 400 }
      );
    }

    const invoice = await prisma.$transaction(async (tx) => {
      await tx.invoiceLineItem.deleteMany({ where: { invoiceId } });
      return tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: existing.status === "DRAFT" ? undefined : "DRAFT",
          subtotal: built.subtotal,
          taxRate: built.taxRate,
          tax: built.tax,
          discount: built.discount,
          total: built.total,
          lineItems: {
            create: built.lineItems.map((l) => ({
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              total: l.total,
              sortOrder: l.sortOrder,
              estimateLineItemId: l.estimateLineItemId,
            })),
          },
        },
        include: {
          project: { select: { id: true, title: true } },
          lineItems: { orderBy: { sortOrder: "asc" } },
        },
      });
    });

    await logActivity({
      action: "UPDATE",
      entityType: "INVOICE",
      entityId: invoiceId,
      entityLabel: existing.invoiceNumber,
      description: `Corrected invoice ${existing.invoiceNumber} (regenerated from actuals)`,
      metadata: {
        total: { from: existing.total, to: built.total },
        lineItemsChanged: true,
      },
      userId,
      projectId: existing.projectId,
    });

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Failed to regenerate invoice:", error);
    return NextResponse.json({ error: "Failed to regenerate invoice" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 3: Manual smoke (API)**

With the dev server running and logged in as ADMIN, take a non-PAID invoice generated from an estimate, change a delivered quantity via the Delivery & Sign-off tab (Save draft), then `curl -X POST` the regenerate endpoint with your session cookie:

```bash
curl -X POST http://localhost:3000/api/projects/<projectId>/invoices/<invoiceId>/regenerate \
  -b "<session cookie>"
```

Expect 200 with updated `lineItems`/`total`; the invoice should now be DRAFT, and an ActivityLog row "Corrected invoice INV-… (regenerated from actuals)" should appear. As MANAGER, expect 403.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/projects/[id]/invoices/[invoiceId]/regenerate/route.ts"
git commit -m "feat(invoices): add ADMIN regenerate endpoint that updates an invoice in place from actuals"
```

---

## Task 5: Delivery & Sign-off tab — drop `lines[]`, handle `correctInvoice`

**Files:**
- Modify: `src/components/projects/delivery-signoff-tab.tsx`

**Why:** Generation no longer needs `lines[]`. And when the admin arrives via the reopen flow (`?correctInvoice=<id>`), the confirm action must regenerate that existing invoice instead of creating a new one.

- [ ] **Step 1: Read the `correctInvoice` param**

`delivery-signoff-tab.tsx` already calls `const searchParams = useSearchParams();` (~line 181) and reads `searchParams.get("estimate")` (~line 186). Add directly below the `requestedEstimateId` line:

```ts
  const correctInvoiceId = searchParams.get("correctInvoice");
```

- [ ] **Step 2: Update `handleConfirm` to branch on correction vs new invoice and stop sending `lines`**

Locate the `handleConfirm` function (around lines 291-320). It currently persists delivery + sign-off, then does `fetch('/api/projects/${projectId}/invoices', { … body: JSON.stringify({ estimateId: activeEstimate.id, mode: "SLICE", lines: […] }) })`, toasts, and `router.push('/invoices/${inv.id}/send')`.

Replace the invoice-generation portion (the part after `persistDelivery()` / `persistSignoff()`) so that:
- It no longer builds or sends a `lines` array.
- If `correctInvoiceId` is set, it POSTs to the regenerate endpoint and navigates to the invoice; otherwise it POSTs to the create endpoint and navigates to the send page.

Concretely, the body of `handleConfirm` after the persistence calls becomes:

```ts
      if (correctInvoiceId) {
        const r3 = await fetch(
          `/api/projects/${projectId}/invoices/${correctInvoiceId}/regenerate`,
          { method: "POST" }
        );
        if (!r3.ok) {
          const j = await r3.json();
          throw new Error(j.error ?? "Failed to regenerate invoice");
        }
        toast.success("Invoice regenerated from actuals");
        router.push(`/invoices/${correctInvoiceId}`);
      } else {
        const r3 = await fetch(`/api/projects/${projectId}/invoices`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estimateId: activeEstimate.id, mode: "SLICE" }),
        });
        if (!r3.ok) {
          const j = await r3.json();
          throw new Error(j.error ?? "Failed to generate invoice");
        }
        const inv = await r3.json();
        toast.success("Draft invoice generated");
        router.push(`/invoices/${inv.id}/send`);
      }
```

Preserve the surrounding `try/catch/finally` and loading-state handling exactly as the existing function has it (match the existing variable names for the loading setter). Only the persistence calls and this generation block change; do not touch `persistDelivery`/`persistSignoff` themselves.

- [ ] **Step 3: Correction banner + button label**

Near the top of the active-estimate section (just inside the main render, before the line-item list), add a banner shown only in correction mode:

```tsx
      {correctInvoiceId && (
        <div
          className="flex items-start gap-2 px-4 py-3 rounded-lg mb-4"
          style={{ background: "#FFF7E6", border: "1px solid #F5C97A" }}
        >
          <div className="text-[12px] text-amber-900 leading-[1.4]">
            Correcting an issued invoice. Adjust the confirmed quantities below, then
            <strong> Save &amp; regenerate</strong> — the invoice will be updated in place and moved
            back to draft for re-sending.
          </div>
        </div>
      )}
```

Then find the confirm button (its label is currently `✓ Confirm & generate draft invoice`, ~line 1042) and make the label conditional:

```tsx
              {correctInvoiceId ? (
                <>✓ Save &amp; regenerate invoice</>
              ) : (
                <>✓ Confirm &amp; generate draft invoice</>
              )}
```

(Replace only the label content inside the button; keep the button's loading/disabled logic.)

- [ ] **Step 4: Type-check**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 5: Manual smoke**

Normal flow (no `correctInvoice`): "Confirm & generate draft invoice" still creates a new draft invoice and routes to its send page. Correction flow is exercised end-to-end in Task 6.

- [ ] **Step 6: Commit**

```bash
git add src/components/projects/delivery-signoff-tab.tsx
git commit -m "feat(delivery): regenerate existing invoice in correction mode; stop sending lines[]"
```

---

## Task 6: Invoice page — revert correction shell, add "Reopen for correction" button

**Files:**
- Create: `src/components/invoices/reopen-correction-button.tsx`
- Modify: `src/app/(dashboard)/invoices/[id]/page.tsx`
- Delete: `src/components/invoices/invoice-correction-shell.tsx`

**Why:** Replace the superseded manual-edit shell with the reopen entry point. The page returns to rendering read-only line items/totals for non-DRAFT invoices, plus an admin-only "Reopen for correction" button for unpaid invoices.

- [ ] **Step 1: Create the reopen button**

Create `src/components/invoices/reopen-correction-button.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReopenCorrectionButtonProps {
  invoiceId: string;
  projectId: string;
  estimateId: string;
}

export function ReopenCorrectionButton({
  invoiceId,
  projectId,
  estimateId,
}: ReopenCorrectionButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function reopen() {
    if (
      !window.confirm(
        "Reopen this invoice for correction? It moves back to DRAFT and returns to the Delivery & Sign-off stage so you can re-confirm the delivered quantities."
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DRAFT" }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to reopen");
      }
      router.push(
        `/projects/${projectId}?tab=completion&estimate=${estimateId}&correctInvoice=${invoiceId}`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reopen");
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={reopen} disabled={loading}>
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
      ) : (
        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
      )}
      Reopen for correction
    </Button>
  );
}
```

- [ ] **Step 2: Revert the shell wiring in the invoice page and add the button**

In `src/app/(dashboard)/invoices/[id]/page.tsx`:

(a) Remove the import line `import { InvoiceCorrectionShell } from "@/components/invoices/invoice-correction-shell";` and add:

```ts
import { ReopenCorrectionButton } from "@/components/invoices/reopen-correction-button";
```

(b) Keep the `auth()` / `isAdmin` lines added previously (they gate the button now).

(c) In the header action row (the `<div className="flex items-center gap-2 flex-wrap justify-end">` that holds `InvoiceStatusChanger` / `CreateRmbInvoiceButton` / PDF link), add the reopen button as the first child, shown only for an admin correcting an unpaid, non-DRAFT invoice that has a source estimate:

```tsx
            {isAdmin &&
              invoice.status !== "DRAFT" &&
              invoice.status !== "PAID" &&
              invoice.estimateId && (
                <ReopenCorrectionButton
                  invoiceId={invoice.id}
                  projectId={invoice.project.id}
                  estimateId={invoice.estimateId}
                />
              )}
```

(d) Replace the `) : ( (() => { … InvoiceCorrectionShell … })() )}` non-DRAFT branch (the IIFE that returns `<InvoiceCorrectionShell>`) with the original read-only blocks rendered directly. The non-DRAFT branch becomes exactly:

```tsx
          ) : (
            <>
              <div>
                <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
                  {"// LINE ITEMS"}
                </p>
                <div
                  className="bg-card-rd rounded-[14px] overflow-hidden"
                  style={{
                    border: "1px solid var(--color-hairline)",
                    boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
                  }}
                >
                  {/* Column header band */}
                  <div
                    className="grid gap-3 px-5 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.06em]"
                    style={{
                      gridTemplateColumns: "1fr 70px 110px 120px",
                      background: "#FAFAF6",
                      borderBottom: "1px solid var(--color-hairline)",
                      color: "var(--color-ink-400)",
                    }}
                  >
                    <span>Description</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Unit price</span>
                    <span className="text-right">Total</span>
                  </div>

                  {/* Lines */}
                  {invoice.lineItems.map((item, i) => (
                    <div
                      key={item.id}
                      className="grid gap-3 items-center px-5 py-3 hover:bg-[#FCFAF6] transition-colors"
                      style={{
                        gridTemplateColumns: "1fr 70px 110px 120px",
                        borderBottom:
                          i < invoice.lineItems.length - 1
                            ? "1px solid var(--color-hairline)"
                            : "none",
                      }}
                    >
                      <div className="text-[13px] font-medium text-ink-900 leading-[1.3] tracking-[-0.005em]">
                        {item.description}
                      </div>
                      <div className="text-right text-[13px] text-ink-700 rd-tabular">
                        {item.quantity}
                      </div>
                      <div className="text-right text-[13px] text-ink-700 rd-tabular">
                        {sym}{fmt(item.unitPrice)}
                      </div>
                      <div className="text-right text-[13px] font-medium text-ink-900 rd-tabular">
                        {sym}{fmt(item.total)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div>
                <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
                  {"// TOTALS"}
                </p>
                <div
                  className="bg-card-rd rounded-[14px] p-5"
                  style={{
                    border: "1px solid var(--color-hairline)",
                    boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
                  }}
                >
                  <div className="max-w-xs ml-auto space-y-1.5">
                    <div className="flex justify-between text-[12px]">
                      <span className="text-ink-500">Subtotal</span>
                      <span className="font-mono rd-tabular text-ink-700">
                        {sym}{fmt(invoice.subtotal)}
                      </span>
                    </div>
                    {invoice.discount > 0 && (
                      <div className="flex justify-between text-[12px]">
                        <span className="text-ink-500">Discount</span>
                        <span className="font-mono rd-tabular text-warn-fg">
                          −{sym}{fmt(invoice.discount)}
                        </span>
                      </div>
                    )}
                    {invoice.taxRate > 0 && (
                      <div className="flex justify-between text-[12px]">
                        <span className="text-ink-500">Tax ({invoice.taxRate}%)</span>
                        <span className="font-mono rd-tabular text-ink-700">
                          {sym}{fmt(invoice.tax)}
                        </span>
                      </div>
                    )}
                    <div
                      className="flex justify-between pt-2 mt-2"
                      style={{ borderTop: "1px solid var(--color-hairline)" }}
                    >
                      <span className="text-[13px] font-bold text-ink-900">Total</span>
                      <span className="font-mono rd-tabular text-[16px] font-bold text-accent-rd">
                        {sym}{fmt(invoice.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
```

(If the current DRAFT branch `{isDraft ? ( … )` was itself modified by the shell wiring, leave it as the inline `InvoiceLineEditor` render it had originally — only the non-DRAFT `:` branch is replaced here.)

- [ ] **Step 3: Delete the shell**

```bash
git rm src/components/invoices/invoice-correction-shell.tsx
```

- [ ] **Step 4: Type-check**

Run: `npm run build`
Expected: clean build. (No remaining references to `InvoiceCorrectionShell`.)

- [ ] **Step 5: Manual smoke (full reopen flow)**

As ADMIN: open a SENT invoice generated from an estimate → "Reopen for correction" appears → click it → invoice goes DRAFT and you land on Delivery & Sign-off for that estimate with the correction banner → change the incentive delivered quantity → "Save & regenerate invoice" → you land back on the invoice (DRAFT), line items + percentage lines updated, activity log shows the regeneration. Re-send from there. Confirm a PAID invoice shows no reopen button; a MANAGER sees no reopen button.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/invoices/[id]/page.tsx" src/components/invoices/reopen-correction-button.tsx
git commit -m "feat(invoices): replace manual correction shell with admin 'Reopen for correction' flow"
```

---

## Task 7: Revert `InvoiceLineEditor` to quantity + discount only

**Files:**
- Modify: `src/components/invoices/invoice-line-editor.tsx`

**Why:** The extended editor (editable description/unit price + add/remove rows) was for the manual-edit approach we dropped. Restore the original so DRAFT editing stays minimal and consistent with "numbers derive from confirmation." Its props interface is unchanged, so the DRAFT branch of the invoice page keeps working.

- [ ] **Step 1: Restore the pre-extension version from git**

The editor was extended in commit `e45c223`. Restore its parent's version:

```bash
git show e45c223^:src/components/invoices/invoice-line-editor.tsx > src/components/invoices/invoice-line-editor.tsx
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: clean build. The invoice page's DRAFT branch passes `{ invoiceId, lineItems, discount, taxRate, currencySymbol }`, which the restored editor accepts (its props interface is unchanged).

- [ ] **Step 3: Manual smoke**

Open a DRAFT invoice: the line editor shows quantity + discount inputs (no description/unit-price editing, no add/remove rows), and "Save Changes" still persists.

- [ ] **Step 4: Commit**

```bash
git add src/components/invoices/invoice-line-editor.tsx
git commit -m "revert(invoices): restore quantity+discount-only line editor (drop manual-edit extensions)"
```

---

## Task 8: Final verification

**Files:** None.

- [ ] **Step 1: Build + lint**

Run: `npm run build` → clean.
Run: `npm run lint` → **no new** errors beyond the pre-existing ones in unrelated files (`auth.ts`, `require-auth.ts`, `service-module-checklist.tsx`, `inquiry-brief-form.tsx`, etc.). The files touched by this plan must be clean.

- [ ] **Step 2: Run the spec's manual test plan**

Work through the "Test plan" section of `docs/superpowers/specs/2026-05-26-invoice-correction-via-reconfirm-design.md`, items 1-8:
1. Resolver parity — existing estimate totals/PDF unchanged.
2. Percentage-aware first generation — 10%/15% derive off delivered.
3. Reopen + regenerate (SENT) — same invoice updated in place; activity logged.
4. PAID path — no reopen until downgraded.
5. Role checks — MANAGER/VIEWER see no reopen; regenerate 403 for MANAGER, 200 for ADMIN.
6. Billing meter consistency.
7. Regression — normal confirm-generate still creates a new invoice; DRAFT line editor works.
8. Reverts — shell gone, extended editor gone, build + lint clean.

- [ ] **Step 3: Report status to the user**

Summarize results. **Do not push** — pushing is gated on explicit user authorization (the branch has never been pushed). When the user authorizes, follow the production deploy procedure in `CLAUDE.md`. Note: this change has **no schema migration**, so the migration step is a no-op.

---

## Self-review notes

- **Spec coverage:** §1 shared resolver → Task 1; routed into billing/estimate displays → Task 2. §2 percentage-aware generation → Task 3. §3 regenerate endpoint → Task 4. §4 reopen→re-confirm→regenerate UI → Tasks 5 (tab) + 6 (page/button). §5 role gating → regenerate ADMIN-only (Task 4), reopen admin-only UI (Task 6), Task-2 PATCH gate retained (untouched). §6 reverts → Tasks 6 (shell) + 7 (editor); Tasks 2 & 3 of the old plan retained. No migration (confirmed). Test plan → Task 8.
- **Addition beyond the spec letter:** Task 2 Step 3 also routes the project page's `estimateTotal()` through the resolver (the spec named only `computeBillingState`). This is in service of spec goal #1 (single source of truth) and prevents a visible mismatch between the billing meter and the project page; flagged for the user.
- **Type consistency:** `BillingLine`/`BillingPhase`/`QuantitySelector` defined in Task 1 are imported unchanged in Tasks 2 & 3. `buildInvoiceFromEstimate` (Task 3) is consumed identically by the POST SLICE branch (Task 3) and the regenerate route (Task 4). `mapEstimateToBillingPhases`/`estimateSubtotal` (Task 2) are reused by `invoice-from-estimate.ts` (Task 3). The reopen button → `?correctInvoice=` param (Task 6) is the exact key the tab reads (Task 5).
- **No placeholders:** all new modules and the regenerate route are given in full; modifications cite exact files and the exact blocks to replace, with the replacement code inline.
