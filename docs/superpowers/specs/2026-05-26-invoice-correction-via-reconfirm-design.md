# Invoice Correction via Re-confirm + Percentage-Aware Generation

**Date:** 2026-05-26
**Status:** Approved (pending user review of this spec)
**Supersedes:** `docs/superpowers/specs/2026-05-14-invoice-corrections-design.md` (the manual in-place line-item editor approach). That design's admin-only **API gate** and **activity-log diff** are retained; its manual-editing UI (extended line editor + `InvoiceCorrectionShell`) is replaced by this design and will be reverted.

## Problem

Two related defects motivate this redesign:

1. **Invoices can't be corrected once issued.** The detail page renders SENT/PAID/OVERDUE invoices read-only. The only workarounds are issuing a duplicate or editing rows in Prisma Studio.

2. **Derived (percentage) line items are not re-derived at invoice time — the real root cause.** Estimates support percentage-basis line items via `EstimateLineItem.percentageBasis` (`SUBTOTAL | PHASE | LINE_ITEM`), `percentageRate`, `basisPhaseName`, `basisLineItemDesc` — e.g. an "incentive processing" line that is **10% of the Incentives line**, or a "project management" line that is **15% of the subtotal**. The estimate builder resolves these correctly (`resolveItemTotal` in `src/components/estimates/estimate-builder.tsx:145-198`). But invoice generation (`POST /api/projects/[id]/invoices`, SLICE mode, `route.ts:76-99`) **flattens every line to `quantity × unitPrice`** and never re-derives the percentage lines. `computeBillingState` (`src/lib/billing.ts:34-37`) does the same.

Consequence: when actuals differ from plan (e.g. fewer incentives distributed), the 10% processing fee and the 15% line do **not** follow. Today a human would have to hand-edit the invoice to fix them — which is error-prone and defeats the point of having the derivation logic. The fix is to make the numbers **derive from confirmed actuals through one shared computation**, and to let an admin re-run that derivation to correct an issued invoice.

## Goals

1. A single source of truth for line totals — including percentage-basis lines — shared by the estimate builder and invoice generation, parameterized only by which quantity feeds the base (planned vs confirmed-delivered).
2. Invoice generation re-derives percentage lines off the **confirmed delivered quantities**, so the 10%-of-incentives fee and the 15%-of-subtotal line are always correct, on both first generation and regeneration.
3. An ADMIN can correct an issued **unpaid** invoice by reopening it back to the Delivery & Sign-off confirm stage, re-confirming the delivered quantities, and regenerating the **same** invoice in place — no manual line editing.
4. MANAGER/VIEWER see no correction affordance on issued invoices; they reach an admin out-of-band (no in-app request flow).
5. Each regeneration is recorded in the activity log with a before/after total diff.

## Non-goals

- No credit notes / separate adjustment documents; corrections update the existing invoice in place.
- No reopen of **PAID** invoices. To correct a paid invoice the admin first downgrades it PAID→SENT with the existing `InvoiceStatusChanger`, after which it is an ordinary unpaid invoice and reopens normally.
- No change to the estimate's **planned** scope/prices as part of a correction. Corrections re-confirm *actuals* (delivered quantities); the derived math follows. (Editing planned scope remains the normal estimate-versioning flow, out of scope here.)
- No automatic propagation to RMB-duplicate invoices. The admin corrects each separately, as today.
- No project-status churn: reopening an invoice does **not** flip the project out of `DELIVERED` or clear `ProjectCompletion` sign-off booleans.
- No schema migration. Every field needed already exists (`deliveredQuantity`, `estimateId`, `estimateLineItemId`, and the percentage fields on `EstimateLineItem`).

## Design

### 1. Shared, percentage-aware totals resolver

Extract the resolution logic currently inside `estimate-builder.tsx` into a pure, server-safe module — `src/lib/estimate-totals.ts`. It exposes a function that resolves a line item's total, generalized over **two things** the two call sites differ on:

- **Quantity selector** — `getQuantity(line) => number`. Estimate builder passes `line => line.quantity` (planned). Invoice generation passes `line => line.deliveredQuantity ?? 0` (confirmed actuals; an unconfirmed line contributes 0).
- **Line identity / LINE_ITEM reference matching** — the builder references a basis line by its client `_key`; the persisted data references it by `basisLineItemDesc`. The resolver operates on a normalized node carrying a stable `id` and a `basisLineItemRef` that matches against that `id`. Each caller maps its own shape into the normalized node before calling (builder: `_key`→id, `basisLineItemKey`→ref; server: DB `id`→id, resolve `basisLineItemDesc`→ the matching line's id).

The resolution rules are preserved exactly from the current implementation:
- **Fixed** (no `percentageBasis`): `getQuantity(line) × unitPrice`.
- **SUBTOTAL**: `rate × Σ(fixed lines + resolved PHASE/LINE_ITEM lines)`, excluding other SUBTOTAL lines (avoids circular refs).
- **PHASE**: `rate × Σ(fixed + PHASE/LINE_ITEM lines within the named phase)`, excluding SUBTOTAL lines.
- **LINE_ITEM**: `rate × (resolved value of the referenced line)`.

The estimate builder is refactored to import this function (no behavior change to estimates — verified by the existing estimate PDF/totals rendering). `computeBillingState` (`src/lib/billing.ts`) is also routed through the resolver (using the planned selector for "estimated" and the delivered selector for "delivered") so the project billing meter agrees with what invoices actually bill. This is a small change once the resolver exists and is required for the displayed numbers to be self-consistent.

### 2. Percentage-aware invoice generation

`POST /api/projects/[id]/invoices` (SLICE mode) is changed so that, instead of emitting only the measured lines passed in `lines[]` as flat `quantity × unitPrice`, it derives **all** lines from the estimate tree + persisted delivered quantities:

- **Quantity source (contract change):** SLICE sources measured quantities from each estimate line's persisted `deliveredQuantity`, **not** from a `lines[]` payload. The confirm UI already persists these via `PATCH /api/projects/[id]/delivery` immediately before generating, so the DB is the single source of truth and the same code path serves both first-generation and regeneration. The `lines[]` field is removed from the SLICE contract; the Delivery & Sign-off tab is updated to stop sending it. (PERCENT/FLAT payloads unchanged.)
- For each **measured** (fixed) line with `deliveredQuantity > 0`: emits an invoice line at `deliveredQuantity × unitPrice`, carrying `estimateLineItemId` for traceability.
- For each **percentage** line whose resolved value (via the shared resolver, delivered selector) is `> 0`: emits an invoice line with that resolved total (`quantity = 1`, `unitPrice = total = resolved`), carrying `estimateLineItemId`.
- Lines resolving to 0 (nothing delivered) are skipped. The existing "no billable lines" guard remains.
- Because generation owns emission of every line (measured + derived), there is no risk of double-counting a percentage line that a caller might otherwise have passed in.

PERCENT and FLAT modes are unchanged. Totals (subtotal/tax/discount/total) continue to roll up from the emitted line totals.

This corrects first-time generation as well. **Note / accepted consequence:** for estimates that use percentage lines, newly generated invoices will total differently than the old flattening produced — that is the intended fix.

### 3. Regenerate endpoint (updates the same invoice in place)

New route: `POST /api/projects/[id]/invoices/[invoiceId]/regenerate` — **ADMIN only**.

- Validates the invoice exists, belongs to the project, has an `estimateId`, and is **not PAID**.
- Recomputes line items + totals from the estimate + current `deliveredQuantity` using the **same builder logic** as §2 (shared, not duplicated).
- Replaces the invoice's line items (`deleteMany` + `createMany`) and updates subtotal/tax/discount/total inside one transaction. Preserves `invoiceNumber`, `estimateId`, `currency`. Sets `status = DRAFT` if it isn't already.
- Logs an activity entry: action `UPDATE`, description `Corrected invoice INV-…`, metadata with before/after `total` (and `lineItemsChanged: true`) — reusing the Task 3 diff shape.

### 4. Reopen → re-confirm → regenerate flow (UI)

- **Invoice detail page** (`src/app/(dashboard)/invoices/[id]/page.tsx`): for a non-DRAFT, **unpaid** (SENT/OVERDUE) invoice, an ADMIN sees a **"Reopen for correction"** button in the header action row (alongside status changer / PDF). It is hidden for non-admins and for PAID invoices. (The page already computes `isAdmin`; that stays.)
- Clicking it reverts the invoice to **DRAFT** and routes to `/projects/[id]?tab=completion&estimate=<estimateId>&correctInvoice=<invoiceId>` (the `?tab=completion&estimate=` deep link already exists).
- **Delivery & Sign-off tab** (`src/components/projects/delivery-signoff-tab.tsx`): when `correctInvoice` is present, it shows a banner ("Correcting invoice INV-…") and its primary action becomes **"Save & regenerate invoice INV-…"** — which persists the edited delivered quantities (`PATCH …/delivery`) and then calls the regenerate endpoint for that invoice (instead of creating a new invoice). On success it routes back to the invoice (now DRAFT, updated) where the admin re-sends.
- Normal (non-correction) confirm flow is unchanged: "Confirm & generate draft invoice" still creates a new invoice.

### 5. Role gating

- The "Reopen for correction" button and the "Save & regenerate" action are ADMIN-only in the UI.
- The regenerate endpoint enforces ADMIN server-side (independent of the UI).
- The existing Task 2 gate on `PATCH /api/invoices/[id]` (ADMIN required for non-DRAFT field corrections; status-only PATCH stays open to MANAGER) is **retained** as a backend guardrail.
- Reverting status to DRAFT on reopen is a status-only change (already within MANAGER's existing ability via the status changer); the meaningful correction — regeneration — is ADMIN-gated, so no new exposure is introduced.

### 6. Reverting the superseded manual-edit work

This branch (`feat/invoice-corrections`) currently contains a manual-edit implementation that this design replaces:

- **Revert Task 1** (`e45c223`): restore `src/components/invoices/invoice-line-editor.tsx` to its prior quantity + discount-only form (remove editable description/unit-price and add/remove-row). Rationale: keep one consistent philosophy — invoice numbers derive from confirmation, not hand-editing — including on DRAFT.
- **Revert Task 4 + 5** (`9d17309`, `d1ee54e`, `8e207aa`): delete `src/components/invoices/invoice-correction-shell.tsx` and remove its wiring from the invoice detail page. The page's non-DRAFT branch returns to read-only line items/totals, **plus** the new admin "Reopen for correction" button. The `isAdmin`/`auth()` additions to the page stay (they now gate the reopen button).
- **Keep Task 2** (`d4e6870`) and **Task 3** (`1f605e3`, `b4a09d3`): the API role gate and the activity-log before/after diff remain useful and are reused by the regenerate flow.

The PDF redesign (Stream B) is unrelated and untouched.

## Data model

No migration. Uses existing fields:
- `EstimateLineItem.deliveredQuantity Float?` — confirmed actual quantity (written by `PATCH …/delivery`).
- `EstimateLineItem.percentageBasis / percentageRate / basisPhaseName / basisLineItemDesc` — percentage derivation inputs.
- `Invoice.estimateId` — source estimate (preserved across regeneration).
- `InvoiceLineItem.estimateLineItemId` — per-line traceability back to the estimate line.

## Risks / considerations

- **First-time invoice totals change** for percentage-using estimates (the intended fix). Surfaced here so it isn't a surprise during verification.
- **Reopening a PAID invoice** is intentionally a two-step, conscious action (downgrade status first). The activity log records the downgrade and the subsequent regeneration.
- **Out-of-sync paper trail** if the client already paid against an older PDF: this remains a manual reconciliation concern for the admin; the activity log is the audit trail. The tool doesn't enforce client communication.
- **Resolver parity** between client (estimate builder) and server (generation/billing) must be exact. The single shared module is what guarantees this; the estimate builder must produce identical totals after the refactor (verify against an existing estimate before/after).
- **RMB-duplicate estimates** are still rejected as invoice sources (existing guard preserved); regenerate validates the same.

## Test plan (manual — no automated test framework)

1. **Resolver parity:** open an existing estimate that uses a SUBTOTAL% and a LINE_ITEM% line; confirm displayed totals and the estimate PDF are unchanged after the refactor.
2. **Percentage-aware first generation:** on a project whose estimate has a 10%-of-incentives line and a 15%-of-subtotal line, confirm delivered quantities with incentives < planned, generate the invoice; verify the 10% line equals 10% of the delivered incentive amount and the 15% line equals 15% of the new subtotal.
3. **Reopen + regenerate (SENT):** issue that invoice (SENT). As ADMIN, "Reopen for correction" → invoice goes DRAFT, lands on Delivery & Sign-off for that estimate → change the incentive delivered quantity → "Save & regenerate" → invoice updates in place (same number); both percentage lines re-derive; activity log shows "Corrected invoice INV-… " with before/after total. Re-send.
4. **PAID path:** confirm a PAID invoice shows no "Reopen for correction"; downgrade PAID→SENT via the status changer, then reopen works.
5. **Role checks:** MANAGER and VIEWER never see "Reopen for correction"; direct `POST …/regenerate` as MANAGER → 403; as ADMIN → 200.
6. **Billing meter consistency:** the project Invoices-tab billing summary (Estimated/Delivered/Invoiced) reflects the percentage lines and matches the regenerated invoice.
7. **Regression:** normal "Confirm & generate draft invoice" (no `correctInvoice`) still creates a new invoice; DRAFT invoices still render the (reverted, quantity+discount) line editor.
8. **Reverts:** `InvoiceCorrectionShell` is gone; the manual extended line editor is gone; build + lint clean.
