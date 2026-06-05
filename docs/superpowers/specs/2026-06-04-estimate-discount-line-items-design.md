# Estimate Discount Line Items — Design

**Date:** 2026-06-04
**Status:** Approved (pending implementation plan)

## Problem

The estimate builder cannot express a discount as an itemized line. The only
discount mechanism today is the estimate-level `discount` field, which is a
single flat amount applied **after tax** (`total = subtotal + tax − discount`)
and is not itemized. Users want a labeled, itemized discount row inside a phase
that reduces the **pre-tax** subtotal — supporting both a fixed amount and a
percentage.

## Decisions (locked during brainstorming)

1. **Itemized, pre-tax.** A discount is a normal line inside a phase; it lowers
   the subtotal before tax (so it also lowers the tax base).
2. **Dedicated "Add discount" affordance** — a purpose-built row, not just
   "type a negative number."
3. **Fixed and percentage** discounts are both supported.
4. **Persisted marker:** add an `isDiscount` boolean column to
   `EstimateLineItem`.
5. **Sign representation = Approach B.** Store **positive magnitudes**; derive
   the negative contribution from `isDiscount` at compute time. Existing inputs
   keep `min="0"` — the user never types a negative number.
6. **Basis-exclusion rule:** discount lines are never part of the basis of any
   percentage line. Fees and discounts both compute off the gross of real work
   lines and never compound on each other.

## Architecture

### 1. Data model — one Prisma migration

Add to `EstimateLineItem`:

```prisma
isDiscount Boolean @default(false)
```

Migration (additive, non-destructive):

```sql
ALTER TABLE "EstimateLineItem" ADD COLUMN "isDiscount" BOOLEAN NOT NULL DEFAULT false;
```

A discount line stores **positive** magnitudes:
- **Fixed:** `quantity = 1`, `unitPrice = <amount>`, `percentageBasis = null`.
- **Percentage:** `percentageBasis ∈ {SUBTOTAL, PHASE, LINE_ITEM}`,
  `percentageRate = <rate 0–100>` (positive).

`InvoiceLineItem` is **not** changed (see Out of Scope).

### 2. Totals engine — `src/lib/estimate-totals.ts` + `src/lib/estimate-billing.ts`

This is the core seam. Both estimate display, margin, and invoice generation
route through `resolveLineTotal`.

- `BillingLine` gains `isDiscount?: boolean`.
- `mapEstimateToBillingPhases` (in `estimate-billing.ts`) copies `isDiscount`
  from the Prisma line into the `BillingLine`. Its `EstimateLineLike` interface
  gains `isDiscount`.
- `resolveLineTotal(line, phases, getQty)`:
  - **Discount, fixed** (`isDiscount && !percentageBasis`): returns
    `−(1 × unitPrice)`. Quantity is pinned to 1 and is **not** scaled by the
    quantity selector — a discount is not a deliverable, so the delivered-qty
    selector must not shrink it.
  - **Discount, percentage** (`isDiscount && percentageBasis`): compute the
    basis exactly as today, then return `−(rate% × basis)`.
  - **Non-discount:** unchanged.
- **Basis-exclusion:** in every basis-accumulation loop (SUBTOTAL, PHASE,
  LINE_ITEM), skip any line where `isDiscount` is true. A LINE_ITEM percentage
  that references a discount line resolves to 0 (treated as no valid target).

`phaseTotal` and `estimateSubtotal` need no change — they sum
`resolveLineTotal`, which now yields negatives for discounts.

### 3. Invoice generation — `src/lib/invoice-from-estimate.ts`

- `EstLine` interface gains `isDiscount`.
- The current guard `if (total <= 0) continue;` would **silently drop**
  discount lines. Change to `if (total === 0) continue;` so negative discount
  lines flow into the invoice (and genuinely empty lines are still skipped).
- Emit discount lines:
  - **Fixed discount:** `quantity = 1`, `unitPrice = total` (negative),
    `total` (negative). Billed in full regardless of delivered quantity.
  - **Percentage discount:** same branch as other percentage lines —
    `quantity = 1`, `unitPrice = total`, `total` resolved off the **delivered**
    basis.
- Subtotal math is unchanged: `subtotal = Σ line.total` now nets the discounts;
  `taxable = subtotal − estimate.discount`; `tax = taxable × rate`.

### 4. Builder UI — `src/components/estimates/estimate-builder.tsx`

- The builder line-item type and the add-line helpers gain `isDiscount`
  (default false). The save payload carries `isDiscount`.
- Per phase: an **"Add discount"** button beside "Add line item." It inserts a
  row with `isDiscount: true`, `description: "Discount"`, `quantity: 1`.
- Discount-row rendering (distinct styling + a `DISCOUNT` tag):
  - **Fixed / Percentage toggle.**
  - *Fixed:* a single positive **Amount** field (no quantity column); maps to
    `unitPrice`, `quantity 1`.
  - *Percentage:* reuses the existing basis selector (Subtotal / Phase /
    Line item) and a positive **rate** input (`min="0" max="100"`).
  - The row's resolved total is displayed negated (e.g. `− $500`).
- A soft inline warning if the estimate total resolves below 0 (allowed, not
  blocked).

### 5. Persistence — `src/app/api/estimates/**` create + update routes

Include `isDiscount` in the line-item create/update writes and in the reads
that hydrate the builder. `generate-estimate` is unaffected (column defaults to
false).

### 6. PDF — `src/lib/pdf/estimate-pdf.tsx`

Render discount lines with their negative total (formatted `− $500`) so the
per-line list visibly nets down to the subtotal. The **invoice PDF needs no
change** — it already prints each line's `total`, which is now negative for
discount lines.

### 7. Margin — `src/lib/margin.ts`

No change required. `estimateNetRevenue` sums `resolveLineTotal` over
non-passthrough lines; discount lines are non-passthrough and now resolve
negative, so net revenue and margin drop by the discount automatically. Discount
lines must **not** be treated as passthrough.

## Testing

Extend `src/lib/margin.test.ts` and add focused `estimate-totals` cases:

1. **Fixed discount, pre-tax:** a `−$500` discount reduces subtotal by 500 and
   reduces tax accordingly.
2. **Percentage discount:** a 10%-of-subtotal discount resolves to the correct
   negative value.
3. **Basis-exclusion:** with a 15% fee line and a discount line present, the fee
   is computed off the non-discount work subtotal (the discount does not reduce
   the fee, and the fee is not applied to the discount).
4. **Invoice carry-through:** `buildInvoiceFromEstimate` includes the discount
   line with a negative total; a **fixed** discount is billed in full even when
   delivered quantities on other lines are reduced.
5. **Margin:** net revenue drops by the discount amount.

## Edge cases

- Discount inputs accept only non-negative magnitudes (`min="0"` retained).
- Percentage rate constrained 0–100.
- Estimate/phase total is allowed to go negative; surface a soft inline warning
  rather than blocking.
- A LINE_ITEM percentage cannot reference a discount row (resolves to 0).

## Out of scope (YAGNI)

- `isDiscount` on `InvoiceLineItem` and discount-specific styling in the invoice
  PDF (invoices carry the correct negative totals regardless).
- Retrofitting or removing the estimate-level `discount` field; it remains a
  separate post-tax mechanism.

## Production-deploy note

This feature requires the additive `EstimateLineItem.isDiscount` migration to be
applied to prod (Cloud SQL, private-IP; migrate via the bastion per
`CLAUDE.md`). The migration is additive (`ADD COLUMN ... DEFAULT false`) and
therefore non-destructive. Back up Cloud SQL before applying, per the
production rules.
