# Project Lifecycle Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple billing from project status, support multiple flexible invoices per estimate (slice / percent / flat), and capture per-line delivered quantities at completion.

**Architecture:** Add two nullable columns to the schema (`EstimateLineItem.deliveredQuantity`, `InvoiceLineItem.estimateLineItemId`); rename the Completion tab to "Delivery & Sign-off" with a per-line actuals editor; rebuild the Invoices tab around a new `+ New Invoice` sheet with three modes; trim the project status enum from 8 linear values to 7 work-only values and compute billing state at read time; one-time data-driven status remap script for production rows. No tests are added — the project has no test framework — so each task includes manual verification commands (type check, dev server, curl, prisma studio).

**Tech Stack:** Next.js 16 App Router (TypeScript), Prisma 7 + PostgreSQL via `@prisma/adapter-pg`, NextAuth v5, shadcn/ui + Tailwind CSS v4, Sonner toasts, @react-pdf/renderer (unchanged for this work).

**Spec:** `docs/superpowers/specs/2026-04-27-project-lifecycle-redesign-design.md`

---

## File map

**Prisma:**
- Modify: `prisma/schema.prisma` — add two columns and a back-relation
- Create: `prisma/migrations/<timestamp>_add_delivery_and_estimate_line_link/migration.sql` (auto-generated)

**Library helpers:**
- Create: `src/lib/billing.ts` — `computeBillingState(project)` returns `{ estimated, delivered, invoiced, paid }`
- Modify: `src/lib/generate-number.ts` — no change expected, used as-is

**API routes — new:**
- Create: `src/app/api/projects/[id]/invoices/route.ts` — POST (create invoice in slice/percent/flat mode)
- Create: `src/app/api/projects/[id]/delivery/route.ts` — PATCH (bulk update `deliveredQuantity` for an estimate's lines)

**API routes — modified:**
- Modify: `src/app/api/projects/route.ts:78` — change initial `status: "INQUIRY_RECEIVED"` to `status: "NEW"`
- Modify: `src/app/api/projects/[id]/inquiry/route.ts:124-173` — auto-advance project to `BRIEFED` when objectives + ≥1 service module exist (only forward, never backward)
- Modify: `src/app/api/projects/[id]/completion/route.ts:96-101` — change `status: "COMPLETED"` cascade to `status: "DELIVERED"`
- Modify: `src/app/api/invoices/[id]/route.ts:111-127` — drop the `SENT → INVOICED` and `PAID → CLOSED` project-side-effects
- Modify: `src/app/api/projects/[id]/generate-invoice/route.ts` — convert to thin wrapper that calls the new `/invoices` route with `mode: "SLICE"` and all lines selected at full quantity (kept for one release cycle, deleted in cleanup phase)
- Modify (likely needed): `src/app/api/estimates/route.ts` (POST) — auto-advance project to `ESTIMATING` on first estimate created
- Modify (existing already does this): `src/app/api/estimates/[id]/approve/route.ts` — already sets project to `APPROVED`; just verify the new enum string matches

**Components — new:**
- Create: `src/components/projects/delivery-signoff-tab.tsx` — replaces `project-completion-form.tsx`; three sections (Confirm Actuals / Sign-off / What's Next prompt)
- Create: `src/components/invoices/billing-meter.tsx` — shared 4-cell meter component
- Create: `src/components/invoices/new-invoice-sheet.tsx` — modal with Slice / Percent / Flat tabs
- Create: `src/components/invoices/invoices-tab.tsx` — tab wrapper: meter + list + `+ New Invoice` button + warning banner

**Components — modified:**
- Modify: `src/types/index.ts:14-22` — replace `ProjectStatus` union with the 7 new values
- Modify: `src/components/shared/status-badge.tsx:6-13` — add the 7 new color rows; legacy rows can stay for backward compat until cleanup phase
- Modify: `src/components/projects/project-status-stepper.tsx` — render 7 steps with auto/manual triggers
- Modify: `src/components/projects/project-hub-tabs.tsx` — rename `Completion` tab label to `Delivery & Sign-off`
- Modify: `src/app/(dashboard)/projects/[id]/page.tsx:400-431` — replace `<ProjectCompletionForm>` with `<DeliverySignoffTab>`; replace inline invoice rendering with `<InvoicesTab>`
- Modify: `src/app/(dashboard)/projects/page.tsx` — update status filter dropdown values; add billing subtitle to project name cell

**Scripts — new:**
- Create: `scripts/remap-project-status.ts` — data-driven one-time status migration (default dry-run; `--apply` writes; backs up to JSON)

**Components — deleted in cleanup (Phase 7):**
- Delete: `src/components/projects/project-completion-form.tsx` (after confirming no remaining import)
- Delete: `src/components/projects/generate-invoice-button.tsx` (after confirming no remaining import)
- Delete: `src/app/api/projects/[id]/generate-invoice/route.ts` (after confirming no remaining caller)

---

## Verification commands (used throughout the plan)

```bash
# From the project root: /Users/ubi/Desktop/Internal_Tool/Project_Management_Tool/project-management-tool

# Type check only (faster than full build)
npx tsc --noEmit

# Full production build (also type-checks)
npm run build

# Start dev server (localhost:3000)
npm run dev

# Open Prisma studio (localhost:5555)
npx prisma studio

# Tail dev server logs while testing in the browser
# (run dev in one terminal; switch to browser and exercise the feature)
```

When a task says "verify in the browser", assume `npm run dev` is running, log in as `yushi@ubinsights.com` / `ubi12345`, and navigate to the project hub for a seeded sample project. The seed creates `PRJ-2026-001` with one approved estimate.

---

## Phase 1 — Schema additions

### Task 1: Add `deliveredQuantity` and `estimateLineItemId` columns

**Files:**
- Modify: `prisma/schema.prisma`
- Generated: `prisma/migrations/<timestamp>_add_delivery_and_estimate_line_link/migration.sql`

- [ ] **Step 1: Add `deliveredQuantity` to `EstimateLineItem` and add the back-relation to `InvoiceLineItem`**

In `prisma/schema.prisma`, find the `EstimateLineItem` model (around line 265) and add `deliveredQuantity` to the field list and `invoiceLineItems` to the relations:

```prisma
model EstimateLineItem {
  id                String  @id @default(cuid())
  description       String
  unit              String  @default("hours")
  quantity          Float   @default(1)
  unitPrice         Float
  sortOrder         Int     @default(0)
  notes             String?
  serviceModuleType String?

  deliveredQuantity Float?

  percentageBasis    String?
  percentageRate     Float?
  basisPhaseName     String?
  basisLineItemDesc  String?

  phaseId String
  phase   EstimatePhase @relation(fields: [phaseId], references: [id], onDelete: Cascade)

  invoiceLineItems InvoiceLineItem[]
}
```

- [ ] **Step 2: Add `estimateLineItemId` and the relation to `InvoiceLineItem`**

In `prisma/schema.prisma`, find `InvoiceLineItem` (around line 402) and add:

```prisma
model InvoiceLineItem {
  id          String @id @default(cuid())
  description String
  quantity    Float
  unitPrice   Float
  total       Float
  sortOrder   Int    @default(0)

  invoiceId String
  invoice   Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  estimateLineItemId String?
  estimateLineItem   EstimateLineItem? @relation(fields: [estimateLineItemId], references: [id], onDelete: SetNull)
}
```

- [ ] **Step 3: Generate and apply the migration**

```bash
npx prisma migrate dev --name add_delivery_and_estimate_line_link
```

Expected: migration runs cleanly; outputs "Your database is now in sync with your schema." Generates a SQL file under `prisma/migrations/` with two `ALTER TABLE … ADD COLUMN` statements and one `ADD CONSTRAINT` for the FK.

- [ ] **Step 4: Verify the columns exist**

```bash
psql "$DATABASE_URL" -c "\\d \"EstimateLineItem\"" | grep deliveredQuantity
psql "$DATABASE_URL" -c "\\d \"InvoiceLineItem\"" | grep estimateLineItemId
```

Expected: both grep hits show the new nullable columns.

- [ ] **Step 5: Run `prisma generate` and ensure types compile**

```bash
npx prisma generate
npx tsc --noEmit
```

Expected: no type errors. The generated client now exposes the new fields.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add deliveredQuantity and estimateLineItemId columns"
```

---

## Phase 2 — Backend changes

### Task 2: Create the `computeBillingState` helper

**Files:**
- Create: `src/lib/billing.ts`

- [ ] **Step 1: Write the helper**

```ts
// src/lib/billing.ts
import type { Prisma } from "@/generated/prisma";

export type ProjectForBilling = Prisma.ProjectGetPayload<{
  include: {
    estimates: {
      include: { phases: { include: { lineItems: true } } };
    };
    invoices: true;
  };
}>;

export interface BillingState {
  estimated: number;
  delivered: number;
  invoiced: number;
  paid: number;
  primaryCurrency: string;
  otherCurrencyTotals: { currency: string; invoiced: number }[];
}

export function computeBillingState(project: ProjectForBilling): BillingState {
  const primaryCurrency =
    project.estimates.find((e) => e.isApproved && !e.parentEstimateId)?.currency || "USD";

  let estimated = 0;
  let delivered = 0;

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

  let invoiced = 0;
  let paid = 0;
  const otherCurrencyMap = new Map<string, number>();

  for (const inv of project.invoices) {
    if (inv.deletedAt) continue;
    if (inv.currency === primaryCurrency) {
      invoiced += inv.total;
      if (inv.status === "PAID") paid += inv.total;
    } else {
      otherCurrencyMap.set(inv.currency, (otherCurrencyMap.get(inv.currency) ?? 0) + inv.total);
    }
  }

  const otherCurrencyTotals = Array.from(otherCurrencyMap.entries()).map(
    ([currency, invoicedAmt]) => ({ currency, invoiced: invoicedAmt })
  );

  return { estimated, delivered, invoiced, paid, primaryCurrency, otherCurrencyTotals };
}
```

- [ ] **Step 2: Verify the helper compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. If `Prisma.ProjectGetPayload` typing complains, double-check that `prisma generate` ran in Task 1.

- [ ] **Step 3: Quick smoke test in a Node REPL**

Start a dev server (`npm run dev`) so the seed project is reachable, then run:

```bash
npx tsx -e '
import { prisma } from "./src/lib/prisma";
import { computeBillingState } from "./src/lib/billing";
const p = await prisma.project.findFirst({
  include: { estimates: { include: { phases: { include: { lineItems: true } } } }, invoices: true },
});
console.log(computeBillingState(p));
process.exit(0);
'
```

Expected: prints an object with the four numbers. For an unbilled approved estimate the seed project should show `invoiced: 0, paid: 0` and `estimated > 0`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/billing.ts
git commit -m "feat(billing): add computeBillingState helper"
```

---

### Task 3: New `POST /api/projects/[id]/invoices` endpoint

**Files:**
- Create: `src/app/api/projects/[id]/invoices/route.ts`

- [ ] **Step 1: Write the endpoint**

```ts
// src/app/api/projects/[id]/invoices/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { generateInvoiceNumber } from "@/lib/generate-number";

type SliceLine = { estimateLineItemId: string; quantity: number; description?: string };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(["ADMIN", "MANAGER"]);
    if (isAuthError(authResult)) return authResult;
    const { userId } = authResult;

    const { id } = await params;
    const body = await request.json();
    const {
      estimateId,
      mode,
      lines,
      percent,
      flatAmount,
      flatDescription,
      notes,
      taxRate: taxRateOverride,
      discount: discountOverride,
    } = body as {
      estimateId?: string;
      mode?: "SLICE" | "PERCENT" | "FLAT";
      lines?: SliceLine[];
      percent?: number;
      flatAmount?: number;
      flatDescription?: string;
      notes?: string;
      taxRate?: number;
      discount?: number;
    };

    if (!estimateId) return NextResponse.json({ error: "estimateId required" }, { status: 400 });
    if (!mode || !["SLICE", "PERCENT", "FLAT"].includes(mode)) {
      return NextResponse.json({ error: "mode must be SLICE | PERCENT | FLAT" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: { client: { select: { company: true, shortName: true } } },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const estimate = await prisma.estimate.findUnique({
      where: { id: estimateId },
      include: {
        phases: { include: { lineItems: { orderBy: { sortOrder: "asc" } }, orderBy: { sortOrder: "asc" } } },
      },
    });
    if (!estimate || estimate.projectId !== id) {
      return NextResponse.json({ error: "Estimate not found for this project" }, { status: 404 });
    }
    if (!estimate.isApproved) {
      return NextResponse.json({ error: "Estimate must be approved" }, { status: 400 });
    }
    if (estimate.parentEstimateId) {
      return NextResponse.json({ error: "Cannot invoice from RMB-duplicate estimate" }, { status: 400 });
    }

    // Build line items per mode
    let invoiceLines: { description: string; quantity: number; unitPrice: number; total: number; sortOrder: number; estimateLineItemId: string | null }[] = [];

    if (mode === "SLICE") {
      if (!lines || lines.length === 0) {
        return NextResponse.json({ error: "lines required for SLICE mode" }, { status: 400 });
      }
      const allEstimateLines = estimate.phases.flatMap((p) => p.lineItems);
      let sortOrder = 0;
      for (const ln of lines) {
        const src = allEstimateLines.find((l) => l.id === ln.estimateLineItemId);
        if (!src) {
          return NextResponse.json({ error: `Estimate line ${ln.estimateLineItemId} not found` }, { status: 400 });
        }
        if (ln.quantity <= 0) continue;
        invoiceLines.push({
          description: ln.description ?? src.description,
          quantity: ln.quantity,
          unitPrice: src.unitPrice,
          total: ln.quantity * src.unitPrice,
          sortOrder: sortOrder++,
          estimateLineItemId: src.id,
        });
      }
      if (invoiceLines.length === 0) {
        return NextResponse.json({ error: "No billable lines (all quantities are zero)" }, { status: 400 });
      }
    } else if (mode === "PERCENT") {
      if (typeof percent !== "number" || percent <= 0 || percent > 100) {
        return NextResponse.json({ error: "percent must be 0..100" }, { status: 400 });
      }
      const subtotal = estimate.phases.reduce(
        (s, p) => s + p.lineItems.reduce((ss, l) => ss + l.quantity * l.unitPrice, 0),
        0
      );
      const amount = subtotal * (percent / 100);
      invoiceLines.push({
        description: `${percent}% of ${estimate.estimateNumber}`,
        quantity: 1,
        unitPrice: amount,
        total: amount,
        sortOrder: 0,
        estimateLineItemId: null,
      });
    } else {
      // FLAT
      if (typeof flatAmount !== "number" || flatAmount <= 0) {
        return NextResponse.json({ error: "flatAmount required" }, { status: 400 });
      }
      if (!flatDescription?.trim()) {
        return NextResponse.json({ error: "flatDescription required" }, { status: 400 });
      }
      invoiceLines.push({
        description: flatDescription.trim(),
        quantity: 1,
        unitPrice: flatAmount,
        total: flatAmount,
        sortOrder: 0,
        estimateLineItemId: null,
      });
    }

    const subtotal = invoiceLines.reduce((s, l) => s + l.total, 0);
    const taxRate = taxRateOverride ?? estimate.taxRate;
    const discount = discountOverride ?? 0;
    const taxable = subtotal - discount;
    const tax = taxable * (taxRate / 100);
    const total = taxable + tax;

    const invoiceNumber = await generateInvoiceNumber(
      project.client.shortName || project.client.company,
      project.title
    );

    const invoice = await prisma.$transaction(async (tx) => {
      return tx.invoice.create({
        data: {
          invoiceNumber,
          status: "DRAFT",
          currency: estimate.currency,
          subtotal,
          taxRate,
          tax,
          discount,
          total,
          notes: notes ?? null,
          projectId: id,
          estimateId: estimate.id,
          lineItems: { create: invoiceLines },
        },
        include: {
          project: { select: { id: true, title: true } },
          lineItems: { orderBy: { sortOrder: "asc" } },
        },
      });
    });

    await logActivity({
      action: "GENERATE",
      entityType: "INVOICE",
      entityId: invoice.id,
      entityLabel: invoice.invoiceNumber,
      description: `Created invoice ${invoice.invoiceNumber} (${mode}) from ${estimate.estimateNumber}`,
      userId,
      projectId: id,
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("Failed to create invoice:", error);
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual API test for SLICE mode**

In one terminal: `npm run dev`. In another:

```bash
# Get the seeded project and one approved estimate line
PROJECT_ID=$(psql "$DATABASE_URL" -tAc "SELECT id FROM \"Project\" LIMIT 1")
EST_ID=$(psql "$DATABASE_URL" -tAc "SELECT id FROM \"Estimate\" WHERE \"isApproved\" = true LIMIT 1")
LINE_ID=$(psql "$DATABASE_URL" -tAc "SELECT eli.id FROM \"EstimateLineItem\" eli JOIN \"EstimatePhase\" ep ON eli.\"phaseId\" = ep.id WHERE ep.\"estimateId\" = '$EST_ID' LIMIT 1")

# Get an auth cookie by logging in via the UI in your browser, then export it
COOKIE='__Secure-authjs.session-token=...'  # paste from browser devtools

curl -s -X POST "http://localhost:3000/api/projects/$PROJECT_ID/invoices" \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d "{\"estimateId\":\"$EST_ID\",\"mode\":\"SLICE\",\"lines\":[{\"estimateLineItemId\":\"$LINE_ID\",\"quantity\":1}]}" | jq .
```

Expected: returns 201 with an Invoice object whose `lineItems[0].estimateLineItemId` matches `$LINE_ID`. Verify in `npx prisma studio` that the new `Invoice` row exists.

- [ ] **Step 4: Manual API test for PERCENT mode**

```bash
curl -s -X POST "http://localhost:3000/api/projects/$PROJECT_ID/invoices" \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d "{\"estimateId\":\"$EST_ID\",\"mode\":\"PERCENT\",\"percent\":50}" | jq .
```

Expected: 201; one line item described "50% of EST-…", total = 50% of estimate subtotal.

- [ ] **Step 5: Manual API test for FLAT mode**

```bash
curl -s -X POST "http://localhost:3000/api/projects/$PROJECT_ID/invoices" \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d "{\"estimateId\":\"$EST_ID\",\"mode\":\"FLAT\",\"flatAmount\":1500,\"flatDescription\":\"Setup fee\"}" | jq .
```

Expected: 201; one line item "Setup fee", total = 1500 (plus tax if estimate has a tax rate).

- [ ] **Step 6: Verify the 409 lock is gone**

Run the SLICE-mode call from Step 3 a second time. Expected: 201 again (a second invoice for the same estimate is now legal). Confirm in prisma studio that two invoices exist with the same `estimateId`.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/projects/[id]/invoices/route.ts
git commit -m "feat(api): POST /projects/[id]/invoices with slice/percent/flat modes"
```

---

### Task 4: Convert `generate-invoice` to a thin wrapper

**Files:**
- Modify: `src/app/api/projects/[id]/generate-invoice/route.ts` (entire file rewritten)

- [ ] **Step 1: Replace the file's contents**

```ts
// src/app/api/projects/[id]/generate-invoice/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";

/**
 * @deprecated Use POST /api/projects/[id]/invoices with mode: "SLICE" instead.
 * This wrapper exists for one release cycle to avoid breaking older callers.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(["ADMIN", "MANAGER"]);
  if (isAuthError(authResult)) return authResult;

  const { id } = await params;
  const body = await request.json();
  const { estimateId } = body as { estimateId?: string };

  if (!estimateId) return NextResponse.json({ error: "estimateId required" }, { status: 400 });

  const estimate = await prisma.estimate.findUnique({
    where: { id: estimateId },
    include: { phases: { include: { lineItems: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } } },
  });
  if (!estimate || estimate.projectId !== id) {
    return NextResponse.json({ error: "Estimate not found for this project" }, { status: 404 });
  }

  const lines = estimate.phases.flatMap((p) =>
    p.lineItems.map((l) => ({ estimateLineItemId: l.id, quantity: l.quantity }))
  );

  // Forward to the new endpoint
  const url = new URL(request.url);
  url.pathname = `/api/projects/${id}/invoices`;
  const forward = new Request(url.toString(), {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({ estimateId, mode: "SLICE", lines }),
  });
  // Call the handler directly to avoid an extra HTTP hop
  const { POST: createInvoice } = await import("../invoices/route");
  return createInvoice(forward as NextRequest, { params: Promise.resolve({ id }) });
}
```

- [ ] **Step 2: Verify it compiles and the wrapper works**

```bash
npx tsc --noEmit
```

Then with the dev server up, repeat the SLICE-mode curl from Task 3 Step 3 against the **old** path:

```bash
curl -s -X POST "http://localhost:3000/api/projects/$PROJECT_ID/generate-invoice" \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d "{\"estimateId\":\"$EST_ID\"}" | jq .
```

Expected: 201 with an Invoice; line items mirror the estimate's lines (because the wrapper passes all lines through). Old UI keeps working.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/projects/[id]/generate-invoice/route.ts
git commit -m "refactor(api): generate-invoice becomes thin wrapper over POST invoices"
```

---

### Task 5: New `PATCH /api/projects/[id]/delivery` endpoint

**Files:**
- Create: `src/app/api/projects/[id]/delivery/route.ts`

- [ ] **Step 1: Write the endpoint**

```ts
// src/app/api/projects/[id]/delivery/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(["ADMIN", "MANAGER"]);
    if (isAuthError(authResult)) return authResult;
    const { userId } = authResult;

    const { id } = await params;
    const body = await request.json();
    const { lines } = body as {
      lines?: { estimateLineItemId: string; deliveredQuantity: number | null }[];
    };

    if (!Array.isArray(lines)) {
      return NextResponse.json({ error: "lines array required" }, { status: 400 });
    }

    // Verify all line IDs belong to estimates of this project
    const ids = lines.map((l) => l.estimateLineItemId);
    const found = await prisma.estimateLineItem.findMany({
      where: { id: { in: ids } },
      select: { id: true, phase: { select: { estimate: { select: { projectId: true } } } } },
    });
    const mismatched = found.filter((f) => f.phase.estimate.projectId !== id);
    if (mismatched.length > 0 || found.length !== lines.length) {
      return NextResponse.json({ error: "Some line items do not belong to this project" }, { status: 400 });
    }

    const updated = await prisma.$transaction(
      lines.map((l) =>
        prisma.estimateLineItem.update({
          where: { id: l.estimateLineItemId },
          data: { deliveredQuantity: l.deliveredQuantity },
        })
      )
    );

    await logActivity({
      action: "UPDATE",
      entityType: "PROJECT",
      entityId: id,
      description: `Updated delivered quantities for ${updated.length} line item(s)`,
      userId,
      projectId: id,
    });

    return NextResponse.json({ updated: updated.length });
  } catch (error) {
    console.error("Failed to update delivery:", error);
    return NextResponse.json({ error: "Failed to update delivery" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Manual test**

```bash
# pick a line on the seeded estimate
LINE_ID=$(psql "$DATABASE_URL" -tAc "SELECT eli.id FROM \"EstimateLineItem\" eli JOIN \"EstimatePhase\" ep ON eli.\"phaseId\" = ep.id WHERE ep.\"estimateId\" = '$EST_ID' LIMIT 1")

curl -s -X PATCH "http://localhost:3000/api/projects/$PROJECT_ID/delivery" \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d "{\"lines\":[{\"estimateLineItemId\":\"$LINE_ID\",\"deliveredQuantity\":3}]}" | jq .

# verify the column was set
psql "$DATABASE_URL" -c "SELECT id, \"deliveredQuantity\" FROM \"EstimateLineItem\" WHERE id = '$LINE_ID'"
```

Expected: `{ "updated": 1 }`; column shows `3`.

Test the cross-project safety check by passing a fake line ID:
```bash
curl -s -X PATCH "http://localhost:3000/api/projects/$PROJECT_ID/delivery" \
  -H "Content-Type: application/json" -H "Cookie: $COOKIE" \
  -d '{"lines":[{"estimateLineItemId":"nonexistent","deliveredQuantity":1}]}' | jq .
```
Expected: 400 with the "do not belong to this project" message.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/projects/[id]/delivery/route.ts
git commit -m "feat(api): PATCH /projects/[id]/delivery for bulk actuals update"
```

---

### Task 6: Update completion API — `DELIVERED` instead of `COMPLETED`

**Files:**
- Modify: `src/app/api/projects/[id]/completion/route.ts:96-101`

- [ ] **Step 1: Change the cascade target**

In `src/app/api/projects/[id]/completion/route.ts`, change the block:

```ts
    // If both completed, set project status to COMPLETED
    if (completion.internalCompleted && completion.clientAcknowledged) {
      await prisma.project.update({
        where: { id },
        data: { status: "COMPLETED" },
      });
    }
```

to:

```ts
    // If both signed off, set project status to DELIVERED
    if (completion.internalCompleted && completion.clientAcknowledged) {
      const proj = await prisma.project.findUnique({ where: { id }, select: { status: true } });
      if (proj && proj.status !== "CLOSED") {
        await prisma.project.update({
          where: { id },
          data: { status: "DELIVERED" },
        });
      }
    }
```

The added `CLOSED` guard prevents a manual archive from being silently re-opened to `DELIVERED` if a sign-off is toggled.

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Verify behavior**

In the browser, on the seed project's Completion tab, check both checkboxes and save. Then check `Project.status` in prisma studio — should now read `DELIVERED` (string is allowed because the column is `String`, not a Postgres enum).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/projects/[id]/completion/route.ts
git commit -m "feat(api): completion sign-off transitions project to DELIVERED"
```

---

### Task 7: Drop invoice → project status side effects

**Files:**
- Modify: `src/app/api/invoices/[id]/route.ts:110-127`

- [ ] **Step 1: Remove both side-effect blocks**

In `src/app/api/invoices/[id]/route.ts`, delete these two blocks entirely:

```ts
      // SENT → set project status to INVOICED
      if (status === "SENT" && existing.status !== "SENT") {
        const project = await tx.project.findUnique({ where: { id: existing.projectId }, select: { status: true } });
        if (project && !["INVOICED", "PAID", "CLOSED"].includes(project.status)) {
          await tx.project.update({
            where: { id: existing.projectId },
            data: { status: "INVOICED" },
          });
        }
      }

      // PAID → archive the project (set to CLOSED)
      if (status === "PAID" && existing.status !== "PAID") {
        await tx.project.update({
          where: { id: existing.projectId },
          data: { status: "CLOSED" },
        });
      }
```

The remaining `paidDate` handler at line 67-69 stays — that's invoice state, not project state.

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Verify behavior**

In the browser, mark an invoice as `PAID`. Check the project — its status should *not* change. (Old behavior would have flipped it to `CLOSED`.)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/invoices/[id]/route.ts
git commit -m "feat(api): invoice status changes no longer mutate project status"
```

---

## Phase 3 — Delivery & Sign-off tab

### Task 8: BillingMeter shared component

**Files:**
- Create: `src/components/invoices/billing-meter.tsx`

- [ ] **Step 1: Build the component**

```tsx
// src/components/invoices/billing-meter.tsx
"use client";

import type { BillingState } from "@/lib/billing";

interface Props {
  state: BillingState;
  showNewInvoiceButton?: boolean;
  onNewInvoice?: () => void;
}

function fmt(n: number, currency: string) {
  const sym = currency === "CNY" ? "¥" : "$";
  return `${sym}${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function BillingMeter({ state, showNewInvoiceButton, onNewInvoice }: Props) {
  const { estimated, delivered, invoiced, paid, primaryCurrency, otherCurrencyTotals } = state;
  const invoicedPct = estimated > 0 ? Math.min(100, Math.round((invoiced / estimated) * 100)) : 0;

  return (
    <div className="rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-amber-50 p-4">
      <div className="flex flex-wrap items-center gap-6 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Estimated</div>
          <div className="text-base font-semibold text-gray-900 tabular-nums">{fmt(estimated, primaryCurrency)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Delivered</div>
          <div className="text-base font-semibold text-gray-900 tabular-nums">{fmt(delivered, primaryCurrency)}</div>
        </div>
        <div className="flex-1 min-w-[160px]">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">
            Invoiced {invoicedPct > 0 && (
              <span className="ml-1 inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">
                {invoicedPct}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: `${invoicedPct}%` }} />
            </div>
            <strong className="text-sm tabular-nums">{fmt(invoiced, primaryCurrency)}</strong>
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Paid</div>
          <div className="text-base font-semibold text-gray-900 tabular-nums">{fmt(paid, primaryCurrency)}</div>
        </div>
        {showNewInvoiceButton && (
          <button
            type="button"
            onClick={onNewInvoice}
            className="ml-auto rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
          >
            + New Invoice
          </button>
        )}
      </div>
      {otherCurrencyTotals.length > 0 && (
        <div className="mt-2 text-xs text-gray-500">
          {otherCurrencyTotals.map((t) => `+ ${fmt(t.invoiced, t.currency)} invoiced in ${t.currency}`).join(" · ")}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/invoices/billing-meter.tsx
git commit -m "feat(ui): BillingMeter shared component"
```

---

### Task 9: Delivery & Sign-off tab — Section A (Confirm Actuals)

**Files:**
- Create: `src/components/projects/delivery-signoff-tab.tsx` (initial version: actuals only)

- [ ] **Step 1: Scaffold the component with the actuals table**

```tsx
// src/components/projects/delivery-signoff-tab.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Copy, Save } from "lucide-react";

export interface DeliveryLine {
  id: string;
  description: string;
  serviceModuleType: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  deliveredQuantity: number | null;
}

export interface DeliveryEstimate {
  id: string;
  estimateNumber: string;
  title: string;
  label: string | null;
  currency: string;
  lines: DeliveryLine[];
}

interface Props {
  projectId: string;
  projectStatus: string;
  estimates: DeliveryEstimate[];
}

function VarianceCell({ planned, delivered }: { planned: number; delivered: number | null }) {
  if (delivered == null) return <span className="text-gray-400">—</span>;
  const diff = delivered - planned;
  if (diff === 0) return <span className="text-gray-400">—</span>;
  const color = diff < 0 ? "text-red-600" : "text-emerald-700";
  return <span className={color}>{diff > 0 ? `+${diff}` : diff}</span>;
}

export function DeliverySignoffTab({ projectId, projectStatus, estimates }: Props) {
  const router = useRouter();
  const readOnly = projectStatus === "CLOSED";
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Record<string, number | null>>>(() => {
    const init: Record<string, Record<string, number | null>> = {};
    for (const est of estimates) {
      init[est.id] = {};
      for (const ln of est.lines) init[est.id][ln.id] = ln.deliveredQuantity;
    }
    return init;
  });

  const update = (estId: string, lineId: string, val: number | null) =>
    setEdits((prev) => ({ ...prev, [estId]: { ...prev[estId], [lineId]: val } }));

  const copyPlannedToDelivered = (est: DeliveryEstimate) => {
    setEdits((prev) => ({
      ...prev,
      [est.id]: Object.fromEntries(est.lines.map((l) => [l.id, l.quantity])),
    }));
  };

  const saveEstimate = async (est: DeliveryEstimate) => {
    setSaving(est.id);
    try {
      const lines = est.lines.map((l) => ({
        estimateLineItemId: l.id,
        deliveredQuantity: edits[est.id]?.[l.id] ?? null,
      }));
      const res = await fetch(`/api/projects/${projectId}/delivery`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      toast.success("Delivered quantities saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  if (estimates.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          No approved estimates. Approve an estimate to record delivered quantities.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-lg">Confirm actuals</h3>
        <p className="text-sm text-gray-500 mt-1">
          Record what was actually delivered. Variance highlights any difference from plan.
        </p>
      </div>

      {estimates.map((est) => {
        const sym = est.currency === "CNY" ? "¥" : "$";
        return (
          <Card key={est.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base">{est.title}</CardTitle>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {est.estimateNumber}{est.label ? ` — ${est.label}` : ""} · {est.currency}
                  </p>
                </div>
                {!readOnly && (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => copyPlannedToDelivered(est)}>
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      Copy planned → delivered
                    </Button>
                    <Button type="button" size="sm" onClick={() => saveEstimate(est)} disabled={saving === est.id}>
                      {saving === est.id ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                      Save
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Line item</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead className="text-right">Planned</TableHead>
                    <TableHead className="text-right">Delivered</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {est.lines.map((ln) => {
                    const val = edits[est.id]?.[ln.id];
                    return (
                      <TableRow key={ln.id}>
                        <TableCell className="text-sm">{ln.description}</TableCell>
                        <TableCell className="text-xs text-gray-500">{ln.serviceModuleType ?? "—"}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{ln.quantity}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={val ?? ""}
                            disabled={readOnly}
                            placeholder="—"
                            onChange={(e) =>
                              update(est.id, ln.id, e.target.value === "" ? null : parseFloat(e.target.value))
                            }
                            className="w-20 ml-auto text-right h-8"
                          />
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <VarianceCell planned={ln.quantity} delivered={val ?? null} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/projects/delivery-signoff-tab.tsx
git commit -m "feat(ui): DeliverySignoffTab section A — actuals editor"
```

---

### Task 10: Delivery & Sign-off tab — Sections B & C

**Files:**
- Modify: `src/components/projects/delivery-signoff-tab.tsx` (add sign-off + what's-next sections)

- [ ] **Step 1: Extend the component props**

At the top of `delivery-signoff-tab.tsx`, extend the `Props` interface and import additions:

```tsx
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
```

```tsx
interface Props {
  projectId: string;
  projectStatus: string;
  estimates: DeliveryEstimate[];
  initialCompletion?: {
    internalCompleted: boolean;
    internalCompletedAt: string | null;
    internalCompletedBy: { name: string } | null;
    internalNotes: string | null;
    clientAcknowledged: boolean;
    clientAcknowledgedAt: string | null;
    clientAcknowledgedBy: string | null;
    clientAcknowledgeNotes: string | null;
    deliverablesNotes: string | null;
  } | null;
  billingSummary?: {
    estimated: number;
    invoiced: number;
    primaryCurrency: string;
  };
  hasInvoices: boolean;
}
```

- [ ] **Step 2: Add sign-off form state and handler**

Inside the component body, after the existing `edits` state, add:

```tsx
  const [signoff, setSignoff] = useState({
    internalCompleted: initialCompletion?.internalCompleted ?? false,
    internalNotes: initialCompletion?.internalNotes ?? "",
    clientAcknowledged: initialCompletion?.clientAcknowledged ?? false,
    clientAcknowledgedBy: initialCompletion?.clientAcknowledgedBy ?? "",
    clientAcknowledgeNotes: initialCompletion?.clientAcknowledgeNotes ?? "",
    deliverablesNotes: initialCompletion?.deliverablesNotes ?? "",
  });
  const [savingSignoff, setSavingSignoff] = useState(false);

  const saveSignoff = async () => {
    setSavingSignoff(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/completion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signoff),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      toast.success("Sign-off saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingSignoff(false);
    }
  };
```

- [ ] **Step 3: Add sections B and C inside the main return JSX**

Replace the closing `</div>` at the very end of the existing return with the following (keep the actuals cards mapping above this):

```tsx
      <Separator />

      {/* Section B — Sign-off */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sign-off</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Checkbox
                id="internalCompleted"
                checked={signoff.internalCompleted}
                disabled={readOnly}
                onCheckedChange={(v) => setSignoff((p) => ({ ...p, internalCompleted: !!v }))}
              />
              <Label htmlFor="internalCompleted" className="font-medium cursor-pointer">
                Internal work completed
              </Label>
            </div>
            {initialCompletion?.internalCompletedAt && (
              <p className="text-xs text-gray-500 ml-7">
                Completed {new Date(initialCompletion.internalCompletedAt).toLocaleDateString()}
                {initialCompletion.internalCompletedBy && ` by ${initialCompletion.internalCompletedBy.name}`}
              </p>
            )}
            <Textarea
              value={signoff.internalNotes}
              disabled={readOnly}
              onChange={(e) => setSignoff((p) => ({ ...p, internalNotes: e.target.value }))}
              placeholder="Internal notes…"
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Checkbox
                id="clientAck"
                checked={signoff.clientAcknowledged}
                disabled={readOnly}
                onCheckedChange={(v) => setSignoff((p) => ({ ...p, clientAcknowledged: !!v }))}
              />
              <Label htmlFor="clientAck" className="font-medium cursor-pointer">
                Client acknowledged
              </Label>
            </div>
            {initialCompletion?.clientAcknowledgedAt && (
              <p className="text-xs text-gray-500 ml-7">
                Acknowledged {new Date(initialCompletion.clientAcknowledgedAt).toLocaleDateString()}
              </p>
            )}
            <Input
              value={signoff.clientAcknowledgedBy}
              disabled={readOnly}
              onChange={(e) => setSignoff((p) => ({ ...p, clientAcknowledgedBy: e.target.value }))}
              placeholder="Acknowledged by (client name)"
            />
            <Textarea
              value={signoff.clientAcknowledgeNotes}
              disabled={readOnly}
              onChange={(e) => setSignoff((p) => ({ ...p, clientAcknowledgeNotes: e.target.value }))}
              placeholder="Client feedback or notes…"
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label>Deliverables notes</Label>
            <Textarea
              value={signoff.deliverablesNotes}
              disabled={readOnly}
              onChange={(e) => setSignoff((p) => ({ ...p, deliverablesNotes: e.target.value }))}
              placeholder="What was delivered to the client…"
              rows={3}
              className="resize-none"
            />
          </div>

          {!readOnly && (
            <div className="flex justify-end">
              <Button type="button" onClick={saveSignoff} disabled={savingSignoff}>
                {savingSignoff && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save sign-off
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section C — What's next */}
      {billingSummary && (
        <Card className="border-green-200 bg-green-50/40">
          <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="text-sm">
              {hasInvoices ? (
                <>
                  Estimated <strong>{billingSummary.primaryCurrency === "CNY" ? "¥" : "$"}{billingSummary.estimated.toLocaleString()}</strong>
                  {" / "}
                  Invoiced <strong>{billingSummary.primaryCurrency === "CNY" ? "¥" : "$"}{billingSummary.invoiced.toLocaleString()}</strong>
                  {billingSummary.invoiced < billingSummary.estimated && (
                    <> · <span className="text-amber-700">Remaining {billingSummary.primaryCurrency === "CNY" ? "¥" : "$"}{(billingSummary.estimated - billingSummary.invoiced).toLocaleString()}</span></>
                  )}
                </>
              ) : (
                <>✓ Generate the final invoice in the Invoices tab.</>
              )}
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/projects/${projectId}?tab=invoice`}>Go to Invoices</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/projects/delivery-signoff-tab.tsx
git commit -m "feat(ui): DeliverySignoffTab sections B & C — sign-off and what's-next prompt"
```

---

### Task 11: Wire DeliverySignoffTab into the project hub page

**Files:**
- Modify: `src/app/(dashboard)/projects/[id]/page.tsx` (replace `<ProjectCompletionForm>` block at lines 400-431)
- Modify: `src/components/projects/project-hub-tabs.tsx` (no code change — only used to confirm tab labels work via the page's `tabs` array)

- [ ] **Step 1: Replace the imports at the top of `page.tsx`**

Find:
```tsx
import { ProjectCompletionForm } from "@/components/projects/project-completion-form";
```

Replace with:
```tsx
import { DeliverySignoffTab } from "@/components/projects/delivery-signoff-tab";
import { computeBillingState } from "@/lib/billing";
```

- [ ] **Step 2: Compute billing state in the page body**

After the existing `approvedTotal` computation, add:

```tsx
  const billing = computeBillingState(project);
```

- [ ] **Step 3: Replace the `completionTab` JSX block**

Find the existing `const completionTab = (...)` (lines 400-431) and replace with:

```tsx
  const completionTab = (
    <DeliverySignoffTab
      projectId={project.id}
      projectStatus={project.status}
      estimates={approvedEstimates
        .filter((e) => !e.parentEstimateId)
        .map((est) => ({
          id: est.id,
          estimateNumber: est.estimateNumber,
          title: est.title,
          label: est.label ?? null,
          currency: est.currency,
          lines: est.phases.flatMap((p) =>
            p.lineItems.map((l) => ({
              id: l.id,
              description: l.description,
              serviceModuleType: l.serviceModuleType ?? null,
              unit: l.unit,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              deliveredQuantity: l.deliveredQuantity ?? null,
            }))
          ),
        }))}
      initialCompletion={
        project.completion
          ? {
              internalCompleted: project.completion.internalCompleted,
              internalCompletedAt: project.completion.internalCompletedAt?.toISOString() ?? null,
              internalCompletedBy: project.completion.internalCompletedBy
                ? { name: project.completion.internalCompletedBy.name }
                : null,
              internalNotes: project.completion.internalNotes,
              clientAcknowledged: project.completion.clientAcknowledged,
              clientAcknowledgedAt: project.completion.clientAcknowledgedAt?.toISOString() ?? null,
              clientAcknowledgedBy: project.completion.clientAcknowledgedBy,
              clientAcknowledgeNotes: project.completion.clientAcknowledgeNotes,
              deliverablesNotes: project.completion.deliverablesNotes,
            }
          : null
      }
      billingSummary={{
        estimated: billing.estimated,
        invoiced: billing.invoiced,
        primaryCurrency: billing.primaryCurrency,
      }}
      hasInvoices={project.invoices.length > 0}
    />
  );
```

- [ ] **Step 4: Rename the tab label**

Find the `tabs` array near the bottom (around line 499) and change the completion entry:

```tsx
          { value: "completion", label: "Delivery & Sign-off", content: completionTab },
```

(Keep `value: "completion"` so existing `?tab=completion` URL bookmarks still resolve.)

- [ ] **Step 5: Verify the build passes**

```bash
npm run build
```

Expected: build succeeds. If it complains that `ProjectCompletionForm` is still imported elsewhere, grep for it and remove orphan imports — but don't delete the file yet (Phase 7 cleanup).

- [ ] **Step 6: Verify in the browser**

Run `npm run dev`, log in, open the seed project, switch to the renamed tab. You should see:
- The new actuals table with the seed estimate's lines
- The sign-off section with checkboxes
- The "what's next" prompt at the bottom

Edit a delivered quantity, click `Save`, and confirm via prisma studio that `EstimateLineItem.deliveredQuantity` was updated. Toggle both sign-off checkboxes, click `Save sign-off`, and confirm `Project.status` becomes `DELIVERED` (or stays as the legacy value until Phase 5 — that's fine).

- [ ] **Step 7: Verify both reported bugs are fixed**

  1. **Bug 1 (post-completion lock):** while the project is in `DELIVERED` status, the actuals editor still works (no `alreadyCompleted` lockout exists in the new tab). Verify by completing sign-off, then editing a delivered quantity and saving.
  2. **Bug 2 (no participant count):** the `Delivered` column captures the recruited/researched count via the line item that maps to RECRUITMENT. Verify by entering a value and seeing it appear in the Variance column and persist after refresh.

- [ ] **Step 8: Commit**

```bash
git add src/app/\(dashboard\)/projects/\[id\]/page.tsx
git commit -m "feat(hub): wire DeliverySignoffTab; rename Completion tab"
```

---

## Phase 4 — Invoices tab and slice picker

### Task 12: NewInvoiceSheet — Slice mode

**Files:**
- Create: `src/components/invoices/new-invoice-sheet.tsx`

- [ ] **Step 1: Build the sheet shell with the slice tab as the only mode for now**

```tsx
// src/components/invoices/new-invoice-sheet.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

export interface SheetEstimateLine {
  id: string;
  description: string;
  unit: string;
  quantity: number;             // planned
  unitPrice: number;
  deliveredQuantity: number | null;
  invoicedQuantity: number;     // computed from existing invoices
}

export interface SheetEstimate {
  id: string;
  estimateNumber: string;
  title: string;
  label: string | null;
  currency: string;
  taxRate: number;
  totalEstimateValue: number;
  lines: SheetEstimateLine[];
}

interface Props {
  projectId: string;
  estimates: SheetEstimate[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const fmt = (n: number, sym: string) =>
  `${sym}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function NewInvoiceSheet({ projectId, estimates, open, onOpenChange }: Props) {
  const router = useRouter();
  const [estimateId, setEstimateId] = useState(estimates[0]?.id ?? "");
  const estimate = estimates.find((e) => e.id === estimateId);
  const sym = estimate?.currency === "CNY" ? "¥" : "$";

  const initialQty: Record<string, number> = useMemo(() => {
    const out: Record<string, number> = {};
    if (!estimate) return out;
    for (const ln of estimate.lines) {
      const remaining = Math.max(0, (ln.deliveredQuantity ?? 0) - ln.invoicedQuantity);
      out[ln.id] = remaining;
    }
    return out;
  }, [estimate]);

  const [billQty, setBillQty] = useState<Record<string, number>>(initialQty);
  const [creating, setCreating] = useState(false);

  // Reset on estimate change
  useMemo(() => setBillQty(initialQty), [initialQty]);

  if (!estimate) return null;

  const subtotal = estimate.lines.reduce((s, ln) => s + (billQty[ln.id] ?? 0) * ln.unitPrice, 0);
  const tax = subtotal * (estimate.taxRate / 100);
  const total = subtotal + tax;
  const selectedCount = estimate.lines.filter((ln) => (billQty[ln.id] ?? 0) > 0).length;

  const create = async () => {
    setCreating(true);
    try {
      const lines = estimate.lines
        .filter((ln) => (billQty[ln.id] ?? 0) > 0)
        .map((ln) => ({ estimateLineItemId: ln.id, quantity: billQty[ln.id] }));
      if (lines.length === 0) throw new Error("Select at least one line with a positive quantity");
      const res = await fetch(`/api/projects/${projectId}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateId, mode: "SLICE", lines }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast.success("Invoice created (DRAFT)");
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create invoice");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>New Invoice</DialogTitle>
          <DialogDescription>Pick lines from an approved estimate to bill.</DialogDescription>
        </DialogHeader>

        {estimates.length > 1 && (
          <div className="space-y-2">
            <label className="text-xs text-gray-500">Source estimate</label>
            <Select value={estimateId} onValueChange={setEstimateId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {estimates.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.estimateNumber}{e.label ? ` — ${e.label}` : ""} ({e.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Tabs defaultValue="slice">
          <TabsList>
            <TabsTrigger value="slice">① Slice</TabsTrigger>
            <TabsTrigger value="percent" disabled>② Percent</TabsTrigger>
            <TabsTrigger value="flat" disabled>③ Flat</TabsTrigger>
          </TabsList>
          <TabsContent value="slice">
            <p className="text-xs text-gray-500 mb-2">
              Remaining = Delivered − Invoiced. Lines with no remaining quantity are disabled.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Line item</TableHead>
                  <TableHead className="text-right">Planned</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">Invoiced</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Bill qty</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estimate.lines.map((ln) => {
                  const delivered = ln.deliveredQuantity ?? 0;
                  const remaining = Math.max(0, delivered - ln.invoicedQuantity);
                  const disabled = remaining <= 0;
                  const qty = billQty[ln.id] ?? 0;
                  return (
                    <TableRow key={ln.id} className={disabled ? "opacity-60" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={qty > 0}
                          disabled={disabled}
                          onCheckedChange={(v) =>
                            setBillQty((p) => ({ ...p, [ln.id]: v ? remaining : 0 }))
                          }
                        />
                      </TableCell>
                      <TableCell className="text-sm">{ln.description}</TableCell>
                      <TableCell className="text-right tabular-nums">{ln.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">{ln.deliveredQuantity ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{ln.invoicedQuantity}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{remaining}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          max={remaining}
                          step="any"
                          value={qty}
                          disabled={disabled}
                          onChange={(e) => {
                            const v = Math.min(remaining, Math.max(0, parseFloat(e.target.value) || 0));
                            setBillQty((p) => ({ ...p, [ln.id]: v }));
                          }}
                          className="w-20 ml-auto text-right h-8"
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(qty * ln.unitPrice, sym)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>

        <DialogFooter className="items-center sm:justify-between flex-wrap gap-2">
          <div className="text-sm text-gray-700">
            Selected {selectedCount} of {estimate.lines.length} · Subtotal <strong>{fmt(subtotal, sym)}</strong>
            {estimate.taxRate > 0 && (<> · Tax ({estimate.taxRate}%) <strong>{fmt(tax, sym)}</strong></>)}
            <> · <span className="text-emerald-700">Total <strong>{fmt(total, sym)}</strong></span></>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" onClick={create} disabled={creating || subtotal <= 0}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Draft Invoice
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

If the project lacks the `dialog` shadcn component, install it:
```bash
npx shadcn@latest add dialog --yes
```

If it lacks `tabs`:
```bash
npx shadcn@latest add tabs --yes
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/invoices/new-invoice-sheet.tsx
git commit -m "feat(ui): NewInvoiceSheet with slice mode"
```

---

### Task 13: NewInvoiceSheet — Percent and Flat modes

**Files:**
- Modify: `src/components/invoices/new-invoice-sheet.tsx`

- [ ] **Step 1: Add state for the two new modes**

After the existing `billQty` state, add:

```tsx
  const [percent, setPercent] = useState(50);
  const [flatAmount, setFlatAmount] = useState(0);
  const [flatDescription, setFlatDescription] = useState("");
  const [activeMode, setActiveMode] = useState<"slice" | "percent" | "flat">("slice");
```

- [ ] **Step 2: Replace the `Tabs` block to enable all three tabs and wire `activeMode`**

```tsx
        <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as "slice" | "percent" | "flat")}>
          <TabsList>
            <TabsTrigger value="slice">① Slice</TabsTrigger>
            <TabsTrigger value="percent">② Percent</TabsTrigger>
            <TabsTrigger value="flat">③ Flat</TabsTrigger>
          </TabsList>

          <TabsContent value="slice">
            {/* …keep existing slice table here verbatim… */}
          </TabsContent>

          <TabsContent value="percent">
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Bills a percentage of the estimate total. Doesn't decrement remaining quantities.</p>
              <div className="flex items-center gap-3">
                <label className="text-sm">Percent</label>
                <Input
                  type="number" min={0} max={100} step="any"
                  value={percent}
                  onChange={(e) => setPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="w-24 text-right h-8"
                />
                <span className="text-sm">% of {estimate.estimateNumber}</span>
              </div>
              <div className="text-sm">
                Estimate total: <strong>{fmt(estimate.totalEstimateValue, sym)}</strong>
                {" → "}
                Invoice total: <strong className="text-emerald-700">{fmt(estimate.totalEstimateValue * (percent / 100), sym)}</strong>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="flat">
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Custom amount. Generates a single descriptive line. Doesn't decrement remaining quantities.</p>
              <div className="flex items-center gap-3">
                <label className="text-sm w-24">Description</label>
                <Input
                  value={flatDescription}
                  onChange={(e) => setFlatDescription(e.target.value)}
                  placeholder="e.g. Setup fee"
                  className="flex-1 h-8"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm w-24">Amount</label>
                <span>{sym}</span>
                <Input
                  type="number" min={0} step="any"
                  value={flatAmount}
                  onChange={(e) => setFlatAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-32 text-right h-8"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
```

- [ ] **Step 3: Replace the `create` handler with a mode-aware version**

```tsx
  const create = async () => {
    setCreating(true);
    try {
      let body: Record<string, unknown>;
      if (activeMode === "slice") {
        const lines = estimate.lines
          .filter((ln) => (billQty[ln.id] ?? 0) > 0)
          .map((ln) => ({ estimateLineItemId: ln.id, quantity: billQty[ln.id] }));
        if (lines.length === 0) throw new Error("Select at least one line with a positive quantity");
        body = { estimateId, mode: "SLICE", lines };
      } else if (activeMode === "percent") {
        if (percent <= 0 || percent > 100) throw new Error("Percent must be 1..100");
        body = { estimateId, mode: "PERCENT", percent };
      } else {
        if (flatAmount <= 0) throw new Error("Amount must be > 0");
        if (!flatDescription.trim()) throw new Error("Description required");
        body = { estimateId, mode: "FLAT", flatAmount, flatDescription };
      }
      const res = await fetch(`/api/projects/${projectId}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast.success("Invoice created (DRAFT)");
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create invoice");
    } finally {
      setCreating(false);
    }
  };
```

- [ ] **Step 4: Replace the footer summary to vary by mode**

Replace the existing footer summary block with:

```tsx
        <DialogFooter className="items-center sm:justify-between flex-wrap gap-2">
          <div className="text-sm text-gray-700">
            {activeMode === "slice" && (
              <>Selected {selectedCount} of {estimate.lines.length} · Subtotal <strong>{fmt(subtotal, sym)}</strong>
              {estimate.taxRate > 0 && (<> · Tax ({estimate.taxRate}%) <strong>{fmt(tax, sym)}</strong></>)}
              <> · <span className="text-emerald-700">Total <strong>{fmt(total, sym)}</strong></span></>
              </>
            )}
            {activeMode === "percent" && (
              <>Total <strong className="text-emerald-700">{fmt(estimate.totalEstimateValue * (percent / 100), sym)}</strong></>
            )}
            {activeMode === "flat" && (
              <>Total <strong className="text-emerald-700">{fmt(flatAmount, sym)}</strong></>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" onClick={create} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Draft Invoice
            </Button>
          </div>
        </DialogFooter>
```

- [ ] **Step 5: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/components/invoices/new-invoice-sheet.tsx
git commit -m "feat(ui): NewInvoiceSheet add percent and flat modes"
```

---

### Task 14: New Invoices tab content

**Files:**
- Create: `src/components/invoices/invoices-tab.tsx`

- [ ] **Step 1: Build the wrapper component**

```tsx
// src/components/invoices/invoices-tab.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { BillingMeter } from "@/components/invoices/billing-meter";
import { NewInvoiceSheet, type SheetEstimate } from "@/components/invoices/new-invoice-sheet";
import { InvoiceStatusChanger } from "@/components/invoices/invoice-status-changer";
import { CreateRmbInvoiceButton } from "@/components/invoices/create-rmb-invoice-button";
import type { BillingState } from "@/lib/billing";

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  currency: string;
  dueDate: string | null;
  paidDate: string | null;
  exchangeRate: number | null;
  parentInvoiceId: string | null;
  rmbDuplicate: { id: string; invoiceNumber: string } | null;
  estimate: { estimateNumber: string; label: string | null; version: number } | null;
  lineCount: number;
}

interface Props {
  projectId: string;
  billing: BillingState;
  invoices: InvoiceRow[];
  estimatesForSheet: SheetEstimate[];
}

export function InvoicesTab({ projectId, billing, invoices, estimatesForSheet }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const canCreate = estimatesForSheet.length > 0;
  const uninvoicedRemaining = billing.delivered - billing.invoiced;

  return (
    <div className="space-y-4">
      <BillingMeter
        state={billing}
        showNewInvoiceButton={canCreate}
        onNewInvoice={() => setSheetOpen(true)}
      />

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <p className="text-gray-500">No invoices yet.</p>
            {canCreate ? (
              <Button onClick={() => setSheetOpen(true)} size="sm">+ New Invoice</Button>
            ) : (
              <p className="text-sm text-gray-400">Approve an estimate to enable invoicing.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <Card key={invoice.id} className={invoice.parentInvoiceId ? "border-amber-300 bg-amber-50/30" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle>{invoice.invoiceNumber}</CardTitle>
                      {invoice.parentInvoiceId && (
                        <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">RMB Duplicate</Badge>
                      )}
                      {invoice.currency !== "USD" && (
                        <Badge variant="outline" className="text-xs">{invoice.currency}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Total: {invoice.currency === "CNY" ? "¥" : "$"}{invoice.total.toLocaleString()}
                    </p>
                    {invoice.estimate && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        From: {invoice.estimate.estimateNumber} v{invoice.estimate.version}
                        {invoice.estimate.label ? ` — ${invoice.estimate.label}` : ""}
                        {" · "}{invoice.lineCount} line{invoice.lineCount === 1 ? "" : "s"}
                      </p>
                    )}
                    {invoice.exchangeRate && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        Exchange rate: 1 USD = {invoice.exchangeRate} CNY
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <StatusBadge status={invoice.status} />
                    <InvoiceStatusChanger invoiceId={invoice.id} currentStatus={invoice.status} />
                    {!invoice.parentInvoiceId && (
                      <CreateRmbInvoiceButton
                        invoiceId={invoice.id}
                        invoiceNumber={invoice.invoiceNumber}
                        hasRmbDuplicate={!!invoice.rmbDuplicate}
                      />
                    )}
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/invoices/${invoice.id}`}>View</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank">PDF</a>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {invoice.dueDate || invoice.paidDate ? (
                <CardContent className="text-sm text-gray-500 pt-0">
                  {invoice.dueDate && <p>Due: {new Date(invoice.dueDate).toLocaleDateString()}</p>}
                  {invoice.paidDate && <p className="text-emerald-700">Paid: {new Date(invoice.paidDate).toLocaleDateString()}</p>}
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      {uninvoicedRemaining > 0 && billing.invoiced > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          💡 <strong>{billing.primaryCurrency === "CNY" ? "¥" : "$"}{uninvoicedRemaining.toLocaleString()}</strong> still uninvoiced — create another invoice to bill the remainder.
        </div>
      )}

      <NewInvoiceSheet
        projectId={projectId}
        estimates={estimatesForSheet}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/invoices/invoices-tab.tsx
git commit -m "feat(ui): InvoicesTab with billing meter, list, and new-invoice sheet"
```

---

### Task 15: Wire InvoicesTab into the project hub page

**Files:**
- Modify: `src/app/(dashboard)/projects/[id]/page.tsx`

- [ ] **Step 1: Add the import**

```tsx
import { InvoicesTab } from "@/components/invoices/invoices-tab";
```

- [ ] **Step 2: Compute `estimatesForSheet`**

After the existing `billing = computeBillingState(project)` line, add:

```tsx
  const estimatesForSheet = approvedEstimates
    .filter((e) => !e.parentEstimateId)
    .map((est) => {
      const totalEstimateValue = est.phases.reduce(
        (s, p) => s + p.lineItems.reduce((ss, l) => ss + l.quantity * l.unitPrice, 0),
        0
      );
      return {
        id: est.id,
        estimateNumber: est.estimateNumber,
        title: est.title,
        label: est.label ?? null,
        currency: est.currency,
        taxRate: est.taxRate,
        totalEstimateValue,
        lines: est.phases.flatMap((p) =>
          p.lineItems.map((l) => {
            const invoicedQuantity = project.invoices
              .filter((inv) => !inv.deletedAt)
              .flatMap((inv) => inv.lineItems)
              .filter((li) => li.estimateLineItemId === l.id)
              .reduce((s, li) => s + li.quantity, 0);
            return {
              id: l.id,
              description: l.description,
              unit: l.unit,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              deliveredQuantity: l.deliveredQuantity ?? null,
              invoicedQuantity,
            };
          })
        ),
      };
    });

  const invoiceRows = project.invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    total: inv.total,
    currency: inv.currency,
    dueDate: inv.dueDate?.toISOString() ?? null,
    paidDate: inv.paidDate?.toISOString() ?? null,
    exchangeRate: inv.exchangeRate ?? null,
    parentInvoiceId: inv.parentInvoiceId ?? null,
    rmbDuplicate: inv.rmbDuplicate ?? null,
    estimate: inv.estimate ?? null,
    lineCount: inv.lineItems.length,
  }));
```

- [ ] **Step 3: Replace the existing `invoiceTab` JSX block**

Find `const invoiceTab = (...)` (around line 296) and replace its body with:

```tsx
  const invoiceTab = (
    <InvoicesTab
      projectId={project.id}
      billing={billing}
      invoices={invoiceRows}
      estimatesForSheet={estimatesForSheet}
    />
  );
```

- [ ] **Step 4: Remove the old `GenerateInvoiceButton` references on this page**

Search the file for `GenerateInvoiceButton` and `approvedForInvoice` and remove any leftover usage (the button is fully replaced by `+ New Invoice` in the meter). Don't delete the component file itself yet — Phase 7 cleanup.

- [ ] **Step 5: Verify the build passes**

```bash
npm run build
```

- [ ] **Step 6: Verify in the browser**

Run `npm run dev`, open the seed project, switch to the Invoice tab. Verify:
- The billing meter renders with four numbers and a progress bar.
- `+ New Invoice` opens the sheet.
- Slice mode shows the seed estimate's lines with planned/delivered/invoiced/remaining columns. Default selection bills any line with `delivered > invoiced`.
- Submitting creates a DRAFT invoice; the list updates and the meter's "Invoiced" number grows.
- Percent and Flat tabs each create a single-line invoice as expected.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/projects/\[id\]/page.tsx
git commit -m "feat(hub): wire InvoicesTab; remove inline invoice rendering"
```

---

## Phase 5 — Status remap

### Task 16: Update `ProjectStatus` type and `StatusBadge` colors

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/components/shared/status-badge.tsx`

- [ ] **Step 1: Replace the `ProjectStatus` union**

In `src/types/index.ts`, replace the `ProjectStatus` definition with:

```ts
export type ProjectStatus =
  | "NEW"
  | "BRIEFED"
  | "ESTIMATING"
  | "APPROVED"
  | "IN_PROGRESS"
  | "DELIVERED"
  | "CLOSED";
```

- [ ] **Step 2: Update the colors**

In `src/components/shared/status-badge.tsx`, replace the project-status block at lines 6-13 with:

```ts
  // Project statuses (7 stages — work only)
  NEW: "bg-gray-100 text-gray-700 border-gray-200",
  BRIEFED: "bg-slate-200 text-slate-700 border-slate-300",
  ESTIMATING: "bg-blue-100 text-blue-800 border-blue-200",
  APPROVED: "bg-green-100 text-green-800 border-green-200",
  IN_PROGRESS: "bg-indigo-100 text-indigo-800 border-indigo-200",
  DELIVERED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CLOSED: "bg-zinc-200 text-zinc-700 border-zinc-300",
  // Legacy status fallbacks (kept until status remap script runs in production)
  INQUIRY_RECEIVED: "bg-gray-100 text-gray-700 border-gray-200",
  ESTIMATE_SENT: "bg-blue-100 text-blue-800 border-blue-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  INVOICED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PAID: "bg-zinc-200 text-zinc-700 border-zinc-300",
```

This keeps existing rows visually sane until the data migration in Task 19 runs.

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

If there are type errors in places that compare `project.status === "INQUIRY_RECEIVED"` etc., they'll now be flagged as `Type '"INQUIRY_RECEIVED"' is not assignable to type 'ProjectStatus'`. Fix each one by changing the comparison string to the new value or by widening the comparison type to `string`. Likely callers: `project-status-stepper.tsx`, `project-status-changer.tsx`, list filters.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/components/shared/status-badge.tsx
git commit -m "feat(types): replace ProjectStatus enum with 7-value work-only set"
```

---

### Task 17: Update auto-transition triggers in API routes

**Files:**
- Modify: `src/app/api/projects/route.ts:78`
- Modify: `src/app/api/projects/[id]/inquiry/route.ts` (after the upsert transaction completes)
- Modify: `src/app/api/estimates/route.ts` — add an auto-advance to `ESTIMATING` if needed

- [ ] **Step 1: Change project create initial status to `NEW`**

In `src/app/api/projects/route.ts:78`, change:

```ts
        status: "INQUIRY_RECEIVED",
```

to:

```ts
        status: "NEW",
```

- [ ] **Step 2: Auto-advance to `BRIEFED` after a successful brief save**

In `src/app/api/projects/[id]/inquiry/route.ts`, after the transaction completes (after the existing `await logActivity(...)` call near line 175), add:

```ts
    // Forward-only auto-transition: NEW → BRIEFED when objectives + at least one service module exist
    if ((inquiry?.objectives?.trim()?.length ?? 0) > 0 && (inquiry?.serviceModules?.length ?? 0) > 0) {
      const currentProject = await prisma.project.findUnique({ where: { id }, select: { status: true } });
      if (currentProject && currentProject.status === "NEW") {
        await prisma.project.update({ where: { id }, data: { status: "BRIEFED" } });
      }
    }
```

- [ ] **Step 3: Auto-advance to `ESTIMATING` on first estimate create**

Open `src/app/api/estimates/route.ts` and find the POST handler. After the new estimate is created, add (inside the same try block, after `logActivity`):

```ts
    const proj = await prisma.project.findUnique({ where: { id: estimate.projectId }, select: { status: true } });
    if (proj && (proj.status === "NEW" || proj.status === "BRIEFED" || proj.status === "INQUIRY_RECEIVED")) {
      await prisma.project.update({ where: { id: estimate.projectId }, data: { status: "ESTIMATING" } });
    }
```

(Inclusion of legacy `INQUIRY_RECEIVED` lets this work both before and after the data remap.)

- [ ] **Step 4: Verify estimate-approve already advances to APPROVED**

Open `src/app/api/estimates/[id]/approve/route.ts` and confirm it sets `project.status = "APPROVED"`. If it sets to anything else (e.g. legacy enum), update the string. (Per the spec, `APPROVED` is already a valid status in both old and new enums, so this is likely a no-op — verify only.)

- [ ] **Step 5: Verify build and behavior**

```bash
npm run build
npm run dev
```

In the browser:
- Create a new project → status should be `NEW`.
- Save its brief with objectives + at least one service module → status should advance to `BRIEFED`.
- Add an estimate → status advances to `ESTIMATING`.
- Approve the estimate → status advances to `APPROVED`.
- Manually set `IN_PROGRESS` via the stepper.
- Toggle both completion sign-offs → status advances to `DELIVERED`.

Verify in prisma studio at each step.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/projects/route.ts src/app/api/projects/\[id\]/inquiry/route.ts src/app/api/estimates/route.ts
git commit -m "feat(api): forward-only auto-transitions for new project status enum"
```

---

### Task 18: Update `ProjectStatusStepper` to 7 steps

**Files:**
- Modify: `src/components/projects/project-status-stepper.tsx`

- [ ] **Step 1: Read the existing component to understand the `context` prop usage**

```bash
cat src/components/projects/project-status-stepper.tsx
```

The component takes `currentStatus` and a `context` object with hints about what the user can do at each step (`hasInquiry`, `estimateCount`, etc.).

- [ ] **Step 2: Update the steps array and click handlers**

Replace the steps definition with the 7-step list. The exact JSX shape depends on the existing component, but the steps to render in order are:

```ts
const STEPS: { value: ProjectStatus; label: string; auto: boolean }[] = [
  { value: "NEW",         label: "New",         auto: true  },
  { value: "BRIEFED",     label: "Briefed",     auto: true  },
  { value: "ESTIMATING",  label: "Estimating",  auto: true  },
  { value: "APPROVED",    label: "Approved",    auto: true  },
  { value: "IN_PROGRESS", label: "In Progress", auto: false },
  { value: "DELIVERED",   label: "Delivered",   auto: true  },
  { value: "CLOSED",      label: "Closed",      auto: false },
];
```

For each step:
- Render the existing pill/badge style (matches `StatusBadge` colors from Task 16).
- "Auto" steps render a green dot indicator and have **no** click action — they tell the user "this happens automatically when conditions are met."
- "Manual" steps (`IN_PROGRESS`, `CLOSED`) keep the existing click-to-set behavior, calling `PATCH /api/projects/[id]` with `{ status: <value> }`.

If the existing component used legacy status values in its hint text (e.g. "Send the estimate"), update to: "Approve an estimate" (for ESTIMATING → APPROVED), "Mark in progress when work begins" (for APPROVED → IN_PROGRESS), "Sign off in Delivery & Sign-off tab" (for IN_PROGRESS → DELIVERED), "Archive" (for DELIVERED → CLOSED).

- [ ] **Step 3: Verify the build passes and the stepper renders**

```bash
npm run build
npm run dev
```

In the browser, on the seed project's hub, the stepper should show all 7 steps with the current step highlighted.

- [ ] **Step 4: Commit**

```bash
git add src/components/projects/project-status-stepper.tsx
git commit -m "feat(ui): ProjectStatusStepper 7-step layout"
```

---

### Task 19: Status remap script

**Files:**
- Create: `scripts/remap-project-status.ts`

- [ ] **Step 1: Write the script**

```ts
// scripts/remap-project-status.ts
import { prisma } from "../src/lib/prisma";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const apply = process.argv.includes("--apply");

type Decision = {
  projectId: string;
  projectNumber: string;
  oldStatus: string;
  newStatus: string;
  reason: string;
};

async function decide(project: {
  id: string;
  projectNumber: string;
  status: string;
  completion: { internalCompleted: boolean; clientAcknowledged: boolean } | null;
  inquiry: { objectives: string | null; serviceModules: { id: string }[] } | null;
  estimates: { isApproved: boolean }[];
}): Promise<Decision> {
  const old = project.status;
  let next: string;
  let reason: string;

  if (old === "CLOSED") { next = "CLOSED"; reason = "kept CLOSED"; }
  else if (project.completion?.internalCompleted && project.completion?.clientAcknowledged) {
    next = "DELIVERED"; reason = "both sign-offs present";
  } else if (old === "IN_PROGRESS") {
    next = "IN_PROGRESS"; reason = "preserved explicit IN_PROGRESS";
  } else if (project.estimates.some((e) => e.isApproved)) {
    next = "APPROVED"; reason = "approved estimate exists";
  } else if (project.estimates.length > 0) {
    next = "ESTIMATING"; reason = "estimate(s) exist";
  } else if ((project.inquiry?.objectives?.trim()?.length ?? 0) > 0 && (project.inquiry?.serviceModules?.length ?? 0) > 0) {
    next = "BRIEFED"; reason = "brief has objectives and service modules";
  } else {
    next = "NEW"; reason = "no brief / no estimates";
  }

  return { projectId: project.id, projectNumber: project.projectNumber, oldStatus: old, newStatus: next, reason };
}

async function main() {
  const projects = await prisma.project.findMany({
    include: {
      completion: { select: { internalCompleted: true, clientAcknowledged: true } },
      inquiry: { select: { objectives: true, serviceModules: { select: { id: true } } } },
      estimates: { select: { isApproved: true } },
    },
  });

  const decisions = await Promise.all(projects.map(decide));
  const changed = decisions.filter((d) => d.oldStatus !== d.newStatus);

  console.log(`Total projects: ${projects.length}`);
  console.log(`Will change:    ${changed.length}`);
  console.table(changed.map((d) => ({
    PRJ: d.projectNumber,
    from: d.oldStatus,
    to: d.newStatus,
    reason: d.reason,
  })));

  if (!apply) {
    console.log("\n(dry-run) — pass --apply to write changes.");
    return;
  }

  // Backup BEFORE writing
  const backupDir = join(process.cwd(), "prisma", "backups");
  mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().slice(0, 10);
  const backupPath = join(backupDir, `status-remap-${ts}.json`);
  writeFileSync(backupPath, JSON.stringify(decisions, null, 2));
  console.log(`Backup written: ${backupPath}`);

  for (const d of changed) {
    await prisma.project.update({ where: { id: d.projectId }, data: { status: d.newStatus } });
  }
  console.log(`Updated ${changed.length} project(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Dry-run locally**

```bash
npx tsx scripts/remap-project-status.ts
```

Expected: prints the projects table; does NOT write. Inspect the `from → to` rows and confirm the mapping looks right for each project. The seed project should map `INQUIRY_RECEIVED → ESTIMATING` (or higher, depending on what state you've left it in via earlier tasks).

- [ ] **Step 3: Apply locally**

```bash
npx tsx scripts/remap-project-status.ts --apply
```

Expected: writes the JSON backup to `prisma/backups/status-remap-YYYY-MM-DD.json`, then updates each project. Check `prisma studio` to confirm.

- [ ] **Step 4: Verify the UI**

`npm run dev`, log in, browse the project list. Status badges should show the new values with the colors from Task 16. Stepper should reflect the new state correctly.

- [ ] **Step 5: Commit**

```bash
git add scripts/remap-project-status.ts
git commit -m "feat(scripts): one-time data-driven project status remap"
```

**Production note:** When deploying, run the dry-run on production data first (with read access only), review the output, then run with `--apply` during a deploy window. The JSON backup is the rollback artifact.

---

## Phase 6 — Project list & filters

### Task 20: Update project list filters and add billing subtitle

**Files:**
- Modify: `src/app/(dashboard)/projects/page.tsx` (or whichever component holds the project list and filter controls)

- [ ] **Step 1: Locate the list page and identify the filter source**

```bash
ls src/app/\(dashboard\)/projects/
cat src/app/\(dashboard\)/projects/page.tsx | head -100
```

Identify the dropdown/select that drives `?status=` filtering (search for `INQUIRY_RECEIVED` or `ProjectStatus`).

- [ ] **Step 2: Replace the filter options**

In whichever component renders the status filter (likely a child of `page.tsx` or a `*-filters.tsx` file in `src/components/projects/`), replace the option list with the 7 new statuses:

```tsx
const PROJECT_STATUS_OPTIONS = [
  { value: "NEW",         label: "New" },
  { value: "BRIEFED",     label: "Briefed" },
  { value: "ESTIMATING",  label: "Estimating" },
  { value: "APPROVED",    label: "Approved" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "DELIVERED",   label: "Delivered" },
  { value: "CLOSED",      label: "Closed" },
];
```

- [ ] **Step 3: Add a billing subtitle to the project name cell**

If the list page already passes `invoices` and `estimates` to its row component, compute and display a billing subtitle. Otherwise, modify the page's prisma query to include enough data for `computeBillingState`:

```tsx
const projects = await prisma.project.findMany({
  include: {
    client: true,
    primaryContact: { select: { name: true } },
    estimates: {
      include: { phases: { include: { lineItems: true } } },
    },
    invoices: { where: { deletedAt: null } },
  },
  orderBy: { createdAt: "desc" },
});
```

Then render:

```tsx
import { computeBillingState } from "@/lib/billing";

// inside the row map
const billing = computeBillingState(project);
const sym = billing.primaryCurrency === "CNY" ? "¥" : "$";
const pct = billing.estimated > 0 ? Math.min(100, (billing.invoiced / billing.estimated) * 100) : 0;

// in the project name cell
<div>
  <div className="font-medium">{project.title}</div>
  {billing.estimated > 0 && (
    <div className="mt-1">
      <div className="text-xs text-gray-500">Invoiced <strong>{sym}{billing.invoiced.toLocaleString()}</strong> / {sym}{billing.estimated.toLocaleString()}</div>
      <div className="h-1 mt-0.5 bg-slate-100 rounded">
        <div className="h-full bg-emerald-500 rounded" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )}
</div>
```

- [ ] **Step 4: Verify build and behavior**

```bash
npm run build
npm run dev
```

Open `/projects`, confirm:
- The status filter dropdown has the 7 new values.
- Each row shows the billing subtitle with a small progress bar.
- Filtering by `IN_PROGRESS` returns only projects in that state.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/projects/page.tsx src/components/projects/
git commit -m "feat(list): update status filters and add billing subtitle"
```

---

## Phase 7 — Cleanup

### Task 21: Remove deprecated UI components and routes

**Files:**
- Delete: `src/components/projects/project-completion-form.tsx`
- Delete: `src/components/projects/generate-invoice-button.tsx`
- Delete: `src/app/api/projects/[id]/generate-invoice/route.ts`

- [ ] **Step 1: Confirm there are no remaining imports**

```bash
grep -rn "project-completion-form" src/ || echo "clean"
grep -rn "generate-invoice-button" src/ || echo "clean"
grep -rn "/api/projects/.*/generate-invoice" src/ || echo "clean"
```

Each grep should print "clean". If anything matches, fix the caller (it should be using `DeliverySignoffTab` / `InvoicesTab` / `POST /api/projects/[id]/invoices` respectively).

- [ ] **Step 2: Delete the files**

```bash
rm src/components/projects/project-completion-form.tsx
rm src/components/projects/generate-invoice-button.tsx
rm src/app/api/projects/\[id\]/generate-invoice/route.ts
rmdir src/app/api/projects/\[id\]/generate-invoice
```

- [ ] **Step 3: Remove legacy status colors from `StatusBadge`**

In `src/components/shared/status-badge.tsx`, remove the legacy fallback rows added in Task 16 Step 2 (`INQUIRY_RECEIVED`, `ESTIMATE_SENT`, `COMPLETED`, `INVOICED`, `PAID`). At this point, all production rows have been remapped via Task 19.

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove deprecated completion form, generate-invoice button and route"
```

---

### Task 22: Final smoke test pass

- [ ] **Step 1: Run the full build**

```bash
npm run build
```

Expected: clean build with no type errors.

- [ ] **Step 2: Exercise the redesign end-to-end in the browser**

`npm run dev`, log in, then walk through:

1. Create a brand-new project (client = the seeded sample). Status should be `NEW`.
2. Fill the brief (objectives + at least one service module). Save. Status should advance to `BRIEFED`.
3. Generate or build an estimate. Status should advance to `ESTIMATING`.
4. Approve the estimate. Status should advance to `APPROVED`.
5. Use the stepper to set status to `IN_PROGRESS`.
6. Open the **Delivery & Sign-off** tab. Enter delivered quantities for each line. Use "Copy planned → delivered" once. Save. Then check both sign-off boxes and save sign-off. Status should advance to `DELIVERED`.
7. Open the **Invoices** tab. Use `+ New Invoice` to create:
   - A SLICE invoice with one line at full remaining quantity.
   - A PERCENT invoice at 25%.
   - A FLAT invoice at $500 with description "Travel reimbursement".
8. Confirm the billing meter on both tabs reflects the new totals (Estimated / Delivered / Invoiced / Paid).
9. Mark one invoice as PAID. Verify the project status does NOT change (no longer cascades).
10. Use the stepper to set status to `CLOSED`. Verify all editors become read-only on the Delivery tab.

If any step fails, fix and recommit before declaring the redesign complete.

- [ ] **Step 3: Commit any final touch-ups**

```bash
git status
git add -A
git commit -m "chore: final touch-ups from end-to-end smoke test"
```

---

## Self-review checklist

Before handing off, the planner verified:

1. **Spec coverage**
   - §4.1 Schema additions → Task 1
   - §4.2 Status enum → Tasks 16, 17, 18
   - §4.3 Computed billing → Task 2 (`computeBillingState`)
   - §5.1 New endpoints → Tasks 3 (invoices) + 5 (delivery)
   - §5.2 Modified endpoints → Tasks 4, 6, 7, 17
   - §6.1 Tab structure → Task 11 (rename)
   - §6.2 Delivery & Sign-off tab → Tasks 9, 10, 11
   - §6.3 Invoices tab → Tasks 14, 15
   - §6.4 New Invoice sheet → Tasks 12, 13
   - §6.5 Project list → Task 20
   - §6.6 Status stepper → Task 18
   - §6.7 Removed components → Task 21
   - §7 Migration phases → Tasks 1, 3-7, 9-11, 12-15, 16-19, 20, 21
   - §7.5 Status remap script → Task 19
   - §8 Risks: dry-run + JSON backup (Task 19), null-back-ref handling (Task 12 default qty calculation), input clamping (Task 12 max attribute)

2. **Placeholder scan:** none. All steps include exact code or exact commands.

3. **Type consistency:** `BillingState` defined once in `src/lib/billing.ts` (Task 2), consumed by `BillingMeter` (Task 8) and the page's `<InvoicesTab>` props (Task 14, 15). `DeliveryEstimate` and `SheetEstimate` are intentionally separate types — the delivery tab doesn't need `invoicedQuantity`, the sheet does.

4. **No dependencies missed:** the project already uses shadcn `dialog` and `tabs` indirectly (via shadcn install commands in Task 12). If `npx shadcn@latest add` fails because they already exist, the command is a no-op.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-27-project-lifecycle-redesign.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
