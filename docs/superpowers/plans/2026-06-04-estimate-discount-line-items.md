# Estimate Discount Line Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the estimate builder add itemized, pre-tax discount rows (fixed amount or percentage) via a dedicated "Add discount" button.

**Architecture:** A discount is a normal `EstimateLineItem` flagged with a new `isDiscount` boolean. The user types a positive magnitude; the builder persists it **negated** (negative `unitPrice` for fixed, negative `percentageRate` for percentage) so the codebase's many `quantity × unitPrice` display sites render it correctly with no changes. The shared totals engine (`estimate-totals.ts`) needs only a basis-exclusion rule plus a full-bill guard for fixed discounts; everything else (margin, invoice generation, PDFs) follows for free.

**Tech Stack:** Next.js 16, TypeScript, Prisma 7 (PostgreSQL), Vitest, React/shadcn.

**Spec:** `docs/superpowers/specs/2026-06-04-estimate-discount-line-items-design.md`

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/lib/estimate-totals.ts` | Pure line-total resolver | Add `isDiscount` to `BillingLine`; fixed-discount full-bill guard; basis-exclusion |
| `src/lib/estimate-totals.test.ts` | Unit tests for resolver | **Create** |
| `prisma/schema.prisma` | DB schema | Add `isDiscount` to `EstimateLineItem` |
| `prisma/migrations/*/migration.sql` | Migration | **Create** (additive `ADD COLUMN`) |
| `src/lib/estimate-billing.ts` | Prisma→BillingLine mapper | Thread `isDiscount` |
| `src/lib/invoice-from-estimate.ts` | Build invoice from estimate | Keep negative discount lines; emit fixed discount at qty 1 |
| `src/lib/margin.ts` | Margin math | Add `isDiscount` to `MarginEstimateLine` (no logic change) |
| `src/lib/margin.test.ts` | Margin tests | Add discount regression tests |
| `src/app/api/estimates/route.ts` | POST create estimate | Persist `isDiscount` |
| `src/app/api/estimates/[id]/route.ts` | PUT update estimate | Persist `isDiscount` |
| `src/app/(dashboard)/estimates/[id]/edit/page.tsx` | Edit-mode hydration | Pass `isDiscount` into `initialData` |
| `src/components/estimates/estimate-builder.tsx` | Builder UI | Types, hydration, payload, "Add discount" button + row UI, soft warning |

---

## Task 1: Totals engine — basis-exclusion + fixed-discount guard

**Files:**
- Modify: `src/lib/estimate-totals.ts`
- Test: `src/lib/estimate-totals.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

Create `src/lib/estimate-totals.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveLineTotal, plannedQty, deliveredQty, type BillingPhase } from "@/lib/estimate-totals";

function phases(lines: BillingPhase["lines"], name = "P1"): BillingPhase[] {
  return [{ name, lines }];
}

describe("resolveLineTotal — discounts", () => {
  it("fixed discount resolves to its (negative) unitPrice under planned qty", () => {
    const disc = { id: "d", quantity: 1, unitPrice: -500, percentageBasis: null, isDiscount: true };
    expect(resolveLineTotal(disc, phases([disc]), plannedQty)).toBe(-500);
  });

  it("fixed discount bills in full under delivered qty even with null deliveredQuantity", () => {
    const disc = { id: "d", quantity: 1, unitPrice: -500, deliveredQuantity: null, percentageBasis: null, isDiscount: true };
    expect(resolveLineTotal(disc, phases([disc]), deliveredQty)).toBe(-500);
  });

  it("percentage discount (negative rate) resolves off non-discount lines", () => {
    const work = { id: "w", quantity: 1, unitPrice: 1000, percentageBasis: null };
    const disc = { id: "d", quantity: 1, unitPrice: 0, percentageBasis: "SUBTOTAL", percentageRate: -10, isDiscount: true };
    const ph = phases([work, disc]);
    expect(resolveLineTotal(disc, ph, plannedQty)).toBe(-100);
  });

  it("basis-exclusion: a % fee ignores sibling discount lines", () => {
    const work = { id: "w", quantity: 1, unitPrice: 1000, percentageBasis: null };
    const fee = { id: "f", quantity: 1, unitPrice: 0, percentageBasis: "SUBTOTAL", percentageRate: 15 };
    const disc = { id: "d", quantity: 1, unitPrice: -200, percentageBasis: null, isDiscount: true };
    const ph = phases([work, fee, disc]);
    expect(resolveLineTotal(fee, ph, plannedQty)).toBe(150); // 15% of 1000, NOT of 800
  });

  it("LINE_ITEM percentage cannot reference a discount row (resolves 0)", () => {
    const disc = { id: "d", quantity: 1, unitPrice: -200, percentageBasis: null, isDiscount: true };
    const pct = { id: "p", quantity: 1, unitPrice: 0, percentageBasis: "LINE_ITEM", percentageRate: 50, basisLineItemId: "d" };
    const ph = phases([disc, pct]);
    expect(resolveLineTotal(pct, ph, plannedQty)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- estimate-totals`
Expected: FAIL (basis-exclusion test returns 120, discount guard tests return 0/NaN — `isDiscount` not yet honored).

- [ ] **Step 3: Add `isDiscount` to `BillingLine`**

In `src/lib/estimate-totals.ts`, add the field to the `BillingLine` interface:

```ts
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
  /** Discount rows are stored negated and excluded from any percentage basis. */
  isDiscount?: boolean;
}
```

- [ ] **Step 4: Add the fixed-discount guard + basis-exclusion in `resolveLineTotal`**

Replace the body of `resolveLineTotal` so it reads:

```ts
export function resolveLineTotal(
  line: BillingLine,
  phases: BillingPhase[],
  getQty: QuantitySelector
): number {
  // Fixed discount: bills in full at qty 1, independent of the quantity
  // selector (a discount is not a deliverable). unitPrice is stored negated.
  if (line.isDiscount && !line.percentageBasis) return line.unitPrice;

  if (!line.percentageBasis) return getQty(line) * line.unitPrice;

  const rate = (line.percentageRate || 0) / 100;

  if (line.percentageBasis === "SUBTOTAL") {
    let basis = 0;
    for (const p of phases) {
      for (const item of p.lines) {
        if (item.id === line.id) continue;
        if (item.isDiscount) continue; // basis-exclusion
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
      if (item.isDiscount) continue; // basis-exclusion
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
        if (target.isDiscount) return 0; // cannot base a % on a discount row
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test -- estimate-totals`
Expected: PASS (5 tests). Also run the full suite to confirm no regression: `npm run test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/estimate-totals.ts src/lib/estimate-totals.test.ts
git commit -m "feat(totals): discount-aware resolver (basis-exclusion + fixed full-bill)"
```

---

## Task 2: Prisma migration — add `isDiscount` to `EstimateLineItem`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_estimate_line_item_discount/migration.sql`

- [ ] **Step 1: Add the column to the schema**

In `prisma/schema.prisma`, in `model EstimateLineItem`, add below `isPassthrough`:

```prisma
  isPassthrough     Boolean @default(false)
  isDiscount        Boolean @default(false)
```

- [ ] **Step 2: Create and apply the migration locally**

Run: `npx prisma migrate dev --name add_estimate_line_item_discount`
Expected: creates the migration folder, applies to the local dev DB, regenerates the Prisma client. The generated `migration.sql` should be:

```sql
ALTER TABLE "EstimateLineItem" ADD COLUMN "isDiscount" BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 3: Verify the client regenerated**

Run: `npx prisma generate`
Expected: "Generated Prisma Client". Confirm `isDiscount` exists on the type:
Run: `grep -n "isDiscount" src/generated/prisma/*.ts | head`
Expected: at least one match.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add EstimateLineItem.isDiscount (additive migration)"
```

---

## Task 3: Mapper — thread `isDiscount` through `estimate-billing.ts`

**Files:**
- Modify: `src/lib/estimate-billing.ts`
- Test: `src/lib/estimate-billing.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/estimate-billing.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapEstimateToBillingPhases } from "@/lib/estimate-billing";

describe("mapEstimateToBillingPhases", () => {
  it("carries isDiscount onto the billing line", () => {
    const est = {
      phases: [
        {
          name: "P1",
          lineItems: [
            {
              id: "d", description: "Discount", quantity: 1, unitPrice: -500,
              deliveredQuantity: null, percentageBasis: null, percentageRate: null,
              basisPhaseName: null, basisLineItemDesc: null, isDiscount: true,
            },
          ],
        },
      ],
    };
    const out = mapEstimateToBillingPhases(est);
    expect(out[0].lines[0].isDiscount).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- estimate-billing`
Expected: FAIL — TypeScript error / `isDiscount` is `undefined` (not mapped).

- [ ] **Step 3: Add `isDiscount` to `EstimateLineLike` and the mapped line**

In `src/lib/estimate-billing.ts`:

In the `EstimateLineLike` interface, add:

```ts
  basisLineItemDesc: string | null;
  isDiscount: boolean;
```

In `mapEstimateToBillingPhases`, in the `.map((li) => ({ ... }))` that builds each line, add `isDiscount`:

```ts
      basisLineItemId:
        li.percentageBasis === "LINE_ITEM" && li.basisLineItemDesc
          ? idByDesc.get(li.basisLineItemDesc) ?? null
          : null,
      isDiscount: li.isDiscount,
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- estimate-billing`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/estimate-billing.ts src/lib/estimate-billing.test.ts
git commit -m "feat(billing): map isDiscount into shared BillingLine"
```

---

## Task 4: Invoice generation — keep discount lines

**Files:**
- Modify: `src/lib/invoice-from-estimate.ts`
- Test: `src/lib/invoice-from-estimate.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/invoice-from-estimate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildInvoiceFromEstimate } from "@/lib/invoice-from-estimate";

const base = {
  description: "x", quantity: 1, unitPrice: 0, deliveredQuantity: null,
  percentageBasis: null, percentageRate: null, basisPhaseName: null,
  basisLineItemDesc: null, isDiscount: false,
};

describe("buildInvoiceFromEstimate — discounts", () => {
  it("includes a fixed discount at qty 1, full magnitude, even when work delivers short", () => {
    const est = {
      taxRate: 0,
      discount: 0,
      phases: [
        {
          name: "P1",
          lineItems: [
            { ...base, id: "w", description: "Work", quantity: 10, unitPrice: 100, deliveredQuantity: 4 },
            { ...base, id: "d", description: "Discount", quantity: 1, unitPrice: -150, isDiscount: true },
          ],
        },
      ],
    };
    const inv = buildInvoiceFromEstimate(est);
    const disc = inv.lineItems.find((l) => l.description === "Discount");
    expect(disc).toBeTruthy();
    expect(disc!.quantity).toBe(1);
    expect(disc!.total).toBe(-150);
    // subtotal = 4*100 - 150 = 250
    expect(inv.subtotal).toBe(250);
  });
});
```

Note: `buildInvoiceFromEstimate`'s `EstLine` does not currently include `id`/`isDiscount`; this test passes them and expects them to be honored.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- invoice-from-estimate`
Expected: FAIL — discount line dropped (current `total <= 0` skip) and/or TS error on `isDiscount`.

- [ ] **Step 3: Add `isDiscount` to `EstLine` and keep negative lines**

In `src/lib/invoice-from-estimate.ts`:

Add `isDiscount` to the `EstLine` interface:

```ts
  basisLineItemDesc: string | null;
  isDiscount: boolean;
```

Change the skip guard from `<= 0` to `=== 0`:

```ts
      const total = resolveLineTotal(bLine, phases, deliveredQty);
      if (total === 0) continue;
```

Change the branch condition so discount lines are emitted flat (qty 1, unitPrice = total):

```ts
      if (src.percentageBasis || src.isDiscount) {
        lineItems.push({
          description: src.description,
          quantity: 1,
          unitPrice: total,
          total,
          sortOrder: sortOrder++,
          estimateLineItemId: src.id,
        });
      } else {
        lineItems.push({
          description: src.description,
          quantity: src.deliveredQuantity ?? 0,
          unitPrice: src.unitPrice,
          total,
          sortOrder: sortOrder++,
          estimateLineItemId: src.id,
        });
      }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- invoice-from-estimate`
Expected: PASS. Full suite: `npm run test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/invoice-from-estimate.ts src/lib/invoice-from-estimate.test.ts
git commit -m "feat(invoice): carry discount lines into generated invoices"
```

---

## Task 5: Margin — type plumbing + regression tests

**Files:**
- Modify: `src/lib/margin.ts`
- Test: `src/lib/margin.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/margin.test.ts` (inside the file, new `describe` block). Note the local `line()` helper's `TestLine` type needs `isDiscount`; add it to the type and the helper default first:

In the `TestLine` type, add:
```ts
  isPassthrough: boolean;
  isDiscount: boolean;
```
In the `line()` default object, add:
```ts
    isPassthrough: false,
    isDiscount: false,
```

Then append:

```ts
describe("margin — discounts", () => {
  function est(lines: TestLine[]): MarginEstimate {
    return {
      isApproved: true,
      parentEstimateId: null,
      currency: "USD",
      phases: [{ name: "P1", lineItems: lines }],
    } as unknown as MarginEstimate;
  }

  it("a fixed discount reduces net revenue", () => {
    const e = est([
      line({ id: "w", quantity: 1, unitPrice: 1000 }),
      line({ id: "d", quantity: 1, unitPrice: -250, isDiscount: true }),
    ]);
    expect(estimateNetRevenue(e, (l) => l.quantity)).toBe(750);
  });

  it("a % fee is computed before the discount (basis-exclusion)", () => {
    const e = est([
      line({ id: "w", quantity: 1, unitPrice: 1000 }),
      line({ id: "f", percentageBasis: "SUBTOTAL", percentageRate: 15 }),
      line({ id: "d", quantity: 1, unitPrice: -200, isDiscount: true }),
    ]);
    // 1000 + 150 (fee on 1000) - 200 = 950
    expect(estimateNetRevenue(e, (l) => l.quantity)).toBe(950);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- margin`
Expected: FAIL — `MarginEstimateLine` has no `isDiscount`, so the mapper drops it and the discount is treated as a normal +/- line (basis-exclusion not applied → fee test returns 970).

- [ ] **Step 3: Add `isDiscount` to `MarginEstimateLine`**

In `src/lib/margin.ts`, in the `MarginEstimateLine` interface add:

```ts
  serviceModuleType: string | null;
  isPassthrough: boolean;
  isDiscount: boolean;
```

No other margin logic changes — `estimateNetRevenue` already routes through `resolveLineTotal`, which now handles discounts.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- margin`
Expected: PASS. Full suite: `npm run test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/margin.ts src/lib/margin.test.ts
git commit -m "feat(margin): isDiscount plumbing + regression tests"
```

---

## Task 6: API routes — persist `isDiscount`

**Files:**
- Modify: `src/app/api/estimates/route.ts`
- Modify: `src/app/api/estimates/[id]/route.ts`

- [ ] **Step 1: POST route — accept + persist `isDiscount`**

In `src/app/api/estimates/route.ts`, in the inline `lineItems?: {...}[]` type, add `isDiscount?: boolean;` after `basisLineItemDesc?: string | null;`. In the `phase.lineItems.map((item, itemIndex) => ({ ... }))` create object, add after `basisLineItemDesc: item.basisLineItemDesc || null,`:

```ts
                              isDiscount: item.isDiscount ?? false,
```

- [ ] **Step 2: PUT route — accept + persist `isDiscount`**

In `src/app/api/estimates/[id]/route.ts`, make the identical two edits: add `isDiscount?: boolean;` to the inline `lineItems?` type, and `isDiscount: item.isDiscount ?? false,` to the create map.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/estimates/route.ts src/app/api/estimates/[id]/route.ts
git commit -m "feat(api): persist EstimateLineItem.isDiscount on create/update"
```

---

## Task 7: Builder — types, hydration, payload (no new UI yet)

**Files:**
- Modify: `src/components/estimates/estimate-builder.tsx`
- Modify: `src/app/(dashboard)/estimates/[id]/edit/page.tsx`

- [ ] **Step 1: Add `isDiscount` to the builder `LineItem` type + `newLineItem`**

In `estimate-builder.tsx`, add to the `LineItem` interface (after `basisLineItemDesc`):

```ts
  basisLineItemDesc: string;
  isDiscount: boolean;
```

In `newLineItem()`, add `isDiscount: false,` to the returned object.

- [ ] **Step 2: Add `isDiscount` to `initialData` line item type**

In `EstimateBuilderProps.initialData.phases[].lineItems[]`, add:

```ts
          basisLineItemDesc?: string | null;
          isDiscount?: boolean;
```

- [ ] **Step 3: Hydrate `isDiscount` and de-negate the magnitude for display**

In the `useState<Phase[]>` initializer (the `initialData.phases.map` → `lineItems.map((li) => ({ ... }))`), change the `unitPrice`/`percentageRate` reads so a discount shows a positive magnitude, and carry the flag:

```ts
        lineItems: p.lineItems.map((li) => ({
          _key: newKey(),
          description: li.description,
          unit: li.unit,
          quantity: li.quantity,
          unitPrice: li.isDiscount ? Math.abs(li.unitPrice) : li.unitPrice,
          notes: li.notes || "",
          percentageBasis: (li.percentageBasis || "") as "" | "SUBTOTAL" | "PHASE" | "LINE_ITEM",
          percentageRate: li.isDiscount
            ? Math.abs(li.percentageRate ?? 0)
            : (li.percentageRate ?? 15),
          basisPhaseName: li.basisPhaseName || "",
          basisLineItemKey: "",
          basisLineItemDesc: li.basisLineItemDesc || "",
          isDiscount: li.isDiscount ?? false,
        })),
```

- [ ] **Step 4: Negate discount magnitudes at the resolution boundary**

The builder keeps **positive** magnitudes in state (so inputs show positive
numbers), but every call into the shared resolver must use the **negated**
values — otherwise the live subtotal would *add* a percentage discount instead
of subtracting it. Negate in both mappers.

In `toSharedPhases`, change the mapped line so discount magnitudes are negated
and the flag is carried:

```ts
    lines: p.lineItems.map((li) => ({
      id: li._key,
      quantity: li.quantity,
      unitPrice: li.isDiscount ? -Math.abs(li.unitPrice) : li.unitPrice,
      percentageBasis: li.percentageBasis || null,
      percentageRate: li.isDiscount ? -Math.abs(li.percentageRate) : li.percentageRate,
      basisPhaseName: li.basisPhaseName,
      basisLineItemId: li.basisLineItemKey || null,
      isDiscount: li.isDiscount,
    })),
```

In `resolveItemTotal`, apply the identical negation to the `self` object:

```ts
  const self = {
    id: li._key,
    quantity: li.quantity,
    unitPrice: li.isDiscount ? -Math.abs(li.unitPrice) : li.unitPrice,
    percentageBasis: li.percentageBasis || null,
    percentageRate: li.isDiscount ? -Math.abs(li.percentageRate) : li.percentageRate,
    basisPhaseName: li.basisPhaseName,
    basisLineItemId: li.basisLineItemKey || null,
    isDiscount: li.isDiscount,
  };
```

Now `resolveItemTotal` returns a **negative** total for any discount row, so the
phase/estimate subtotals net down correctly in the live preview.

- [ ] **Step 5: Negate on save in the payload**

In `handleSubmit`'s `payload.phases[].lineItems.map((li, j) => { ... })`, replace the `return { ... }` so discounts persist negated and carry the flag. Use this exact block:

```ts
          const isPercentage = li.percentageBasis !== "";
          // resolveItemTotal already negates discount magnitudes (Step 4), so
          // resolvedTotal is negative for a percentage discount.
          const resolvedTotal = isPercentage ? resolveItemTotal(li, phases) : null;
          const basisLabel =
            li.percentageBasis === "SUBTOTAL"
              ? "estimate subtotal"
              : li.percentageBasis === "LINE_ITEM"
              ? li.basisLineItemDesc || "line item"
              : li.basisPhaseName || "unknown";
          const ratePrefix = li.isDiscount ? `${li.percentageRate}% discount of ` : `${li.percentageRate}% of `;

          return {
            description: li.description,
            unit: isPercentage ? `${ratePrefix}${basisLabel}` : li.unit,
            // Percentage lines flatten to their resolved total (already negative
            // for a discount). Fixed discounts persist the negated magnitude.
            quantity: isPercentage ? 1 : li.quantity,
            unitPrice: isPercentage
              ? (resolvedTotal ?? 0)
              : li.isDiscount
              ? -Math.abs(li.unitPrice)
              : li.unitPrice,
            sortOrder: j,
            notes: li.notes || null,
            percentageBasis: li.percentageBasis || null,
            // Negate the rate for a percentage discount so it round-trips and
            // resolves negative on the server.
            percentageRate: isPercentage
              ? (li.isDiscount ? -Math.abs(li.percentageRate) : li.percentageRate)
              : null,
            basisPhaseName: li.percentageBasis === "PHASE" ? li.basisPhaseName : null,
            basisLineItemDesc: li.percentageBasis === "LINE_ITEM" ? li.basisLineItemDesc : null,
            isDiscount: li.isDiscount,
          };
```

- [ ] **Step 6: Pass `isDiscount` from the edit page into `initialData`**

In `src/app/(dashboard)/estimates/[id]/edit/page.tsx`, in the `p.lineItems.map((li) => ({ ... }))`, add:

```ts
              basisLineItemDesc: li.basisLineItemDesc,
              isDiscount: li.isDiscount,
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/estimates/estimate-builder.tsx "src/app/(dashboard)/estimates/[id]/edit/page.tsx"
git commit -m "feat(builder): isDiscount plumbing — hydrate, resolve, persist negated"
```

---

## Task 8: Builder — "Add discount" button + discount row UI

**Files:**
- Modify: `src/components/estimates/estimate-builder.tsx`

This task is UI; verification is typecheck + manual (`npm run dev`). Each step shows exact code.

- [ ] **Step 1: Add an `addDiscountLine` helper**

Near the existing add-line helpers (after `enablePercentageMode`/`disablePercentageMode`), add:

```ts
  function addDiscountLine(phaseKey: string) {
    setPhases((prev) =>
      prev.map((p) =>
        p._key === phaseKey
          ? {
              ...p,
              lineItems: [
                ...p.lineItems,
                {
                  ...newLineItem(),
                  description: "Discount",
                  unit: "discount",
                  quantity: 1,
                  unitPrice: 0,
                  percentageRate: 10,
                  isDiscount: true,
                },
              ],
            }
          : p
      )
    );
  }
```

- [ ] **Step 2: Render an "Add discount" button next to "Add line item"**

Find the existing "Add line item" button (search for the `onClick` that calls the add-line-item helper within a phase footer). Add, immediately after it, a sibling button:

```tsx
                  <button
                    type="button"
                    onClick={() => addDiscountLine(phase._key)}
                    className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-900"
                  >
                    <span className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase">{"// + DISCOUNT"}</span>
                  </button>
```

(Match the existing button's wrapper/spacing; place it in the same flex row.)

- [ ] **Step 3: Branch the line row for discounts**

In the line-item row render, the current structure is `{isPercent ? (<percent cells>) : (<qty/price/total cells>)}`. Introduce a discount branch. Compute, near where `isPercent` is derived for the row:

```tsx
                        const isDiscountRow = item.isDiscount;
                        const isPercentDiscount = isDiscountRow && item.percentageBasis !== "";
```

Replace the row's value-cells conditional with three cases. For a **fixed discount** (`isDiscountRow && !isPercentDiscount`), render a single Amount input spanning the qty+price columns and a negated total:

```tsx
                        {isDiscountRow && !isPercentDiscount ? (
                          <>
                            <span className="text-right text-[13px] text-ink-300 rd-tabular">—</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) =>
                                updateLineItem(phase._key, item._key, "unitPrice", parseFloat(e.target.value) || 0)
                              }
                              className="text-[13px] text-right rd-tabular text-ink-700 bg-transparent border-0 shadow-none focus-visible:ring-0 px-0 h-auto py-0"
                              placeholder="Amount"
                            />
                            <span className="text-right text-[13px] font-medium rd-tabular" style={{ color: "var(--color-warn-fg)" }}>
                              − {sym}{fmt(Math.abs(item.quantity * item.unitPrice))}
                            </span>
                          </>
                        ) : isPercent || isPercentDiscount ? (
                          <>
                            <span className="text-right text-[13px] text-ink-300 rd-tabular">—</span>
                            <span className="text-right text-[13px] text-ink-300 rd-tabular">—</span>
                            <span className="text-right text-[13px] font-medium rd-tabular" style={{ color: isDiscountRow ? "var(--color-warn-fg)" : "var(--color-accent-rd)" }}>
                              {isDiscountRow ? "− " : ""}{sym}{fmt(Math.abs(computedTotal))}
                            </span>
                          </>
                        ) : (
                          <>
                            {/* existing Qty / Unit price / Total cells unchanged */}
                          </>
                        )}
```

Keep the existing non-discount, non-percent cells in the final `else` branch (move the current qty/price/total JSX there verbatim).

- [ ] **Step 4: Add a DISCOUNT tag + discount-aware percentage toggle**

For discount rows, show a tag and let the user pick Fixed vs Percentage. Where the row renders the description/unit controls, when `isDiscountRow` is true, render a small toggle that calls the existing `enablePercentageMode(phase._key, item._key)` (for percentage) / `disablePercentageMode(...)` (for fixed) — these already exist and set `percentageBasis`. Add a visible tag near the description:

```tsx
                        {isDiscountRow && (
                          <span className="font-mono text-[9px] font-bold tracking-[0.08em] uppercase px-1.5 py-0.5 rounded" style={{ background: "var(--color-warn-bg)", color: "var(--color-warn-fg)" }}>
                            DISCOUNT
                          </span>
                        )}
```

For a percentage discount, the existing percentage sub-row (rate input `min=0 max=100` + basis selector) is reused as-is — it already reads/writes `percentageRate`/`percentageBasis`. The rate shows the positive magnitude (negation happens only on save).

- [ ] **Step 5: Typecheck + manual verification**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run dev`, open an estimate in edit mode, and verify manually:
- "Add discount" inserts a row tagged DISCOUNT with a single Amount field.
- Typing `500` shows the row total as `− $500.00` and reduces the subtotal.
- Toggling to Percentage shows the rate input; `10%` reduces subtotal by 10% of the non-discount lines.
- A sibling `15% of subtotal` fee is **not** reduced by the discount.
- Save, reload the edit page: the discount round-trips (positive input, DISCOUNT tag, correct sign).

- [ ] **Step 6: Commit**

```bash
git add src/components/estimates/estimate-builder.tsx
git commit -m "feat(builder): Add discount button + discount row UI"
```

---

## Task 9: Soft warning when an estimate total goes negative

**Files:**
- Modify: `src/components/estimates/estimate-builder.tsx`

- [ ] **Step 1: Render a non-blocking warning**

Near the totals summary (where `total` is displayed), add below it:

```tsx
            {total < 0 && (
              <p className="text-[11px]" style={{ color: "var(--color-warn-fg)" }}>
                Heads up: discounts exceed the estimate total (net is negative).
              </p>
            )}
```

This is informational only — saving is **not** blocked.

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/components/estimates/estimate-builder.tsx
git commit -m "feat(builder): soft warning when net total is negative"
```

---

## Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Unit tests**

Run: `npm run test`
Expected: all pass (including the new estimate-totals, estimate-billing, invoice-from-estimate, and margin discount tests).

- [ ] **Step 2: Lint + type-check via build**

Run: `npm run lint` then `npm run build`
Expected: lint clean; build succeeds (build also runs the TS type-check).

- [ ] **Step 3: Manual end-to-end (dev)**

Run: `npm run dev`. Create a new estimate with a real phase, add a fixed discount and a percentage discount, save, generate the PDF (`/api/estimates/<id>/pdf`) and confirm discount rows print negative and the subtotal nets down. Approve the estimate, confirm delivery, generate an invoice, and confirm the discount carries into the invoice.

- [ ] **Step 4: Commit any fixups**

```bash
git add -A
git commit -m "chore: verification fixups for estimate discounts" || echo "nothing to commit"
```

---

## Task 11: Production deploy (requires explicit approval)

**Files:** none (ops). Follow `CLAUDE.md` → Production Deployment. The migration is additive (`ADD COLUMN ... DEFAULT false`) and therefore **non-destructive**, but it still touches prod — get the user's go-ahead first.

- [ ] **Step 1: Merge the feature branch** (open a PR or fast-forward `main` per the user's preference).

- [ ] **Step 2: Back up Cloud SQL**

```bash
gcloud sql backups create --instance=ubinsights --project internal-tools-489020 \
  --description="Pre-deploy estimate-discounts $(date -u +%Y%m%dT%H%M%SZ)"
```

- [ ] **Step 3: Apply the migration via the VPC bastion** (see `CLAUDE.md` deploy flow — start `internal-tools`, `npx prisma migrate deploy` against the Cloud SQL DSN, stop the bastion). Confirm `_prisma_migrations` now includes `add_estimate_line_item_discount`.

- [ ] **Step 4: Deploy the new revision**

```bash
gcloud run deploy pmt --source . --region us-central1 --project internal-tools-489020
```

- [ ] **Step 5: Smoke test**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://pmt.ubinsights.com/login
```
Expected: `200`. Then open an estimate, add a discount, save — confirm it persists in prod.

---

## Notes for the implementer

- **DRY:** all sign/discount logic lives in `resolveLineTotal`. Never re-derive a discount's sign in a display site — render `quantity × unitPrice` (already negative) or call the resolver.
- **The builder is the only place that holds positive magnitudes.** Storage, API, and every read are negative. If you find yourself negating in a second place, stop and reconsider.
- **Do not add `min` changes** to the existing inputs — discounts keep positive inputs by design.
