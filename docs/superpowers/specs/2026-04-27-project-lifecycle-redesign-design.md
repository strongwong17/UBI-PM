# Project Lifecycle Redesign — Design Spec

**Date:** 2026-04-27
**Author:** Yushi (with Claude)
**Status:** Approved for implementation planning

---

## 1. Background

The current Project hub conflates two concerns: **work** (what's been delivered) and **billing** (what's been invoiced and paid). This causes two concrete bugs and several structural pain points.

**Two reported bugs:**

1. **Invoice generation locked after completion.** `project-completion-form.tsx:241` hides the invoice-generation UI when the project status is `COMPLETED | INVOICED | PAID | CLOSED`. Any estimate approved *after* the first completion sign-off cannot be invoiced from the UI. The API itself is fine — only the UI gates it.
2. **No way to record actual participants.** `Inquiry.participantCount` stores the *planned* count from the brief. `ProjectCompletion` has no field for actuals. There is no schema-level concept of "delivered vs. estimated."

**Structural pain points (confirmed during brainstorming):**

- The status enum (`INQUIRY_RECEIVED → ESTIMATE_SENT → APPROVED → IN_PROGRESS → COMPLETED → INVOICED → PAID → CLOSED`) is a single linear sequence that mixes work state and billing state. Real projects have multiple invoices and partial payments, which the current enum cannot express.
- The `generate-invoice` API enforces "one invoice per estimate" via a 409 check, blocking deposit/milestone/ad-hoc partial-billing patterns the team needs.
- The "final invoice" today is built by blindly copying every estimate line. Variances between planned and delivered are not captured.

**Out of scope (decided during brainstorming):**

- Formal change-order entity. Scope changes mid-project continue to be handled by version-bumping the estimate.
- Multiple `ProjectCompletion` rows per project (phased completion). Single completion record per project remains.
- Per-service-module completion as a separate construct. Module rollups are derived from line-item actuals.

## 2. Goals

1. Allow any number of invoices per project, billed against an approved estimate via three modes: **slice** (line items), **percent of total**, or **flat amount**.
2. Capture per-line **delivered quantity** as part of project completion. Surface variance against planned.
3. Replace the linear 8-step status with a 7-step **work-only** status. Billing state is computed from invoice rows, not stored.
4. Remove the post-completion lock on invoice generation. The UI must allow invoice creation at any project state where an approved estimate exists.
5. Preserve all existing production data. No drops, no resets.

## 3. Non-goals

- No change to the Brief, Estimate Builder, or Execution tabs.
- No change to PDF rendering for estimates and invoices.
- No change to authentication, roles, or permission model.
- No change to the activity log or attachment subsystem.
- No change to the RMB-duplicate mechanism for estimates and invoices.

## 4. Data model

### 4.1 New columns

```prisma
model EstimateLineItem {
  // ... existing fields ...
  deliveredQuantity Float?  // null = not yet recorded
}

model InvoiceLineItem {
  // ... existing fields ...
  estimateLineItemId String?
  estimateLineItem   EstimateLineItem? @relation(fields: [estimateLineItemId], references: [id], onDelete: SetNull)
}

model EstimateLineItem {
  // ... existing fields ...
  deliveredQuantity Float?
  invoiceLineItems  InvoiceLineItem[]  // back-ref for "already invoiced" rollup
}
```

Both columns are nullable — no defaults, no data loss on existing rows. `deliveredQuantity` defaults to "not recorded yet"; the UI treats null as a blank input. `estimateLineItemId` left null on legacy invoice lines (created before this migration); new invoices created via the slice picker always populate it.

### 4.2 Status enum (code-side change only)

`Project.status` is stored as `String` in the schema, so this is not a Prisma migration — it's a change to the validation list in `src/types/index.ts` and `src/components/shared/status-badge.tsx`.

| Status | Trigger | Auto/Manual |
|---|---|---|
| `NEW` | Project created | auto |
| `BRIEFED` | Brief saved (objectives + at least one service module) | auto |
| `ESTIMATING` | First estimate created | auto |
| `APPROVED` | Any estimate marked `isApproved=true` | auto |
| `IN_PROGRESS` | Manual transition via stepper | manual |
| `DELIVERED` | Both `internalCompleted` and `clientAcknowledged` true on `ProjectCompletion` | auto |
| `CLOSED` | Manual transition via stepper | manual |

Auto-transitions are forward-only (e.g., once `APPROVED`, deleting the only approved estimate doesn't roll back to `ESTIMATING` automatically). Manual downgrades remain possible via the stepper.

### 4.3 Computed billing state

Four numbers, computed at read time on the project hub:

```
Estimated  = sum( line.unitPrice × line.quantity )      for all approved-estimate, original-only (parentEstimateId = null) lines
Delivered  = sum( line.unitPrice × line.deliveredQuantity ) for the same line set, treating null as 0
Invoiced   = sum( invoice.total ) for all non-deleted invoices on the project
Paid       = sum( invoice.total ) for all non-deleted invoices where status = PAID
```

Currency = project's primary currency (USD by default). If non-primary-currency invoices or RMB-duplicate estimates exist, a secondary line shows e.g. *"+ ¥21,000 invoiced in CNY"* — these are not summed into the primary numbers.

## 5. API

### 5.1 New endpoints

**`POST /api/projects/[id]/invoices`** — replaces the role of `generate-invoice`.

```ts
// body
{
  estimateId: string,       // required: source estimate (must be approved, must belong to project)
  mode: "SLICE" | "PERCENT" | "FLAT",
  lines?: [                 // required when mode = SLICE
    { estimateLineItemId: string, quantity: number, description?: string }
  ],
  percent?: number,         // 0..100, required when mode = PERCENT
  flatAmount?: number,      // required when mode = FLAT
  flatDescription?: string, // required when mode = FLAT
  notes?: string,
  taxRate?: number,         // overrides estimate's taxRate; defaults to it
  discount?: number
}
```

Returns the created `Invoice` with line items. Drops the existing 409 check for "one invoice per estimate." Each created `InvoiceLineItem` populates `estimateLineItemId` in SLICE mode; PERCENT and FLAT modes create a single descriptive line with `estimateLineItemId = null`.

**`PATCH /api/projects/[id]/delivery`** — bulk update delivered quantities.

```ts
// body
{
  lines: [
    { estimateLineItemId: string, deliveredQuantity: number | null }
  ]
}
```

Single transaction. Returns `{ updated: number }`.

### 5.2 Modified endpoints

- `POST /api/projects/[id]/generate-invoice` — kept as a thin wrapper that calls the new endpoint with `mode: "SLICE"` and all lines selected at full estimate quantity. Wrapper exists for one release cycle so that any code path still using it keeps working; deleted in cleanup phase.
- `PATCH /api/projects/[id]/completion` — auto-transitions project to `DELIVERED` (was `COMPLETED`) when both sign-offs are true. No longer touches `INVOICED` or `PAID`.
- `PATCH /api/invoices/[id]` — when status flips to `PAID`, no longer auto-changes project status. Project status is independent of billing state in the new model.
- All status-write paths (`POST /api/projects`, brief upsert, estimate create/approve, completion sign-off) updated to emit the new auto-transition statuses.

### 5.3 Removed endpoint behaviors

- The 409 "An invoice already exists for this estimate" check in `generate-invoice/route.ts` is removed.
- Auto-transition `INVOICED → PAID` cascade in `invoices/[id]/route.ts` removed.

## 6. UI

### 6.1 Tab structure

`Overview | Brief | Estimates | Execution | Delivery & Sign-off | Invoices`

- `Completion` tab is renamed to `Delivery & Sign-off` and gains the actuals editor (see 6.2).
- `Invoices` tab keeps its slot but its contents are rebuilt (see 6.3).
- All other tabs unchanged.

### 6.2 Delivery & Sign-off tab

Three stacked sections:

**Section A — Confirm actuals.** For each approved estimate (excluding RMB duplicates), a table:

| Line item | Module | Planned | Delivered (editable) | Variance |

- "Delivered" defaults to blank; first-edit autofills with planned. Null = "not yet recorded."
- Variance: red if `delivered < planned`, green if `>`, dash if equal or null.
- Per-estimate "Copy planned → delivered" button to fill the column quickly.
- Save button persists via `PATCH /api/projects/[id]/delivery`.
- Read-only view with a banner if the project is `CLOSED`.

**Section B — Sign-off.** Today's two checkboxes (`internalCompleted`, `clientAcknowledged`) plus their notes. Existing schema, no change. When both are true, project transitions to `DELIVERED` automatically.

**Section C — "What's next" prompt.** A quiet card at the bottom of the tab:

- If no invoices exist: *"✓ Delivered. Generate the final invoice in the Invoices tab."* with a link.
- If invoices exist: *"Estimated $12,000 / Invoiced $6,000 / Remaining $6,000 to invoice → Go to Invoices"* with a link.

The current "Generate Final Invoice" button on the completion form is removed. Invoice creation happens entirely on the Invoices tab.

### 6.3 Invoices tab

**Header:** `BillingMeter` component — four cells (Estimated / Delivered / Invoiced / Paid) with a progress bar on Invoiced/Estimated. Same component reused on the Delivery & Sign-off tab.

**Body:** existing invoice list (largely unchanged), plus:

- A `+ New Invoice` button next to the meter (shown when at least one approved estimate exists).
- A subtle warning banner under the list if `Invoiced < Delivered` (i.e., uninvoiced delivered work remains): *"💡 $6,000 still uninvoiced — moderation, reporting and incentives lines remain."*
- Each invoice row gets a "From: EST-XXXX · N lines" subtitle.

### 6.4 New Invoice sheet

Modal/drawer opened by `+ New Invoice`. Inner tabs for the three modes:

**① Slice (default)** — table with columns: checkbox, line item, planned, delivered, **invoiced** (sum across non-deleted invoices for that estimate line), **remaining** (`delivered - invoiced`, clamped to ≥0), bill quantity (editable), subtotal. Rows where `remaining = 0` are disabled. Default: all rows with `remaining > 0` are checked, bill quantity = remaining.

**② Percent** — single number input (0–100). Generates one invoice line described as *"50% of EST-2026-0042"* (or whatever the percent and estimate number are), total = percent × estimate total. No effect on remaining quantities.

**③ Flat** — amount input + description input. Generates one invoice line: *"Custom — {description}"*. No effect on remaining quantities.

Footer: subtotal, tax (from estimate's `taxRate`, editable), total. Buttons: `Cancel`, `Create Draft Invoice`. The created invoice opens in `DRAFT` status; the user moves it to `SENT` / `PAID` separately.

If the project has multiple approved estimates, an estimate selector appears at the top of the sheet. RMB-duplicate estimates (where `parentEstimateId` is non-null) are excluded as a source — invoicing always happens against the original estimate, with currency conversion handled by the existing RMB-duplicate flow on the resulting invoice.

### 6.5 Project list

- Status column uses the new 7-value enum with the colors specified in §4.2.
- Project name cell gains a small subtitle: *"Invoiced $6,000 / $12,000"* with a 4px progress bar underneath. Empty when no estimates approved yet.
- Filters update to the new status set.

### 6.6 Status stepper

`ProjectStatusStepper` updated to render 7 steps: `NEW → BRIEFED → ESTIMATING → APPROVED → IN_PROGRESS → DELIVERED → CLOSED`. Auto-transitions render with a green dot; manual transitions render with a button on hover (existing pattern).

### 6.7 What's removed

- `src/components/projects/project-completion-form.tsx` — replaced by a new component built around the three sections in 6.2.
- `GenerateInvoiceButton` from the project hub — replaced by the `+ New Invoice` button on the Invoices tab.
- The "pending estimates" + quantity editor logic on the completion form (now covered by 6.2 + 6.4).

## 7. Migration

Production data preservation is mandatory. No drops, no resets, no destructive operations. All migrations gated by user approval before running on prod.

### 7.1 Phase 1 — Schema additions

Single Prisma migration adds the two nullable columns (`EstimateLineItem.deliveredQuantity`, `InvoiceLineItem.estimateLineItemId`). Run via `prisma migrate deploy`. Old code keeps working since the new columns are unread.

### 7.2 Phase 2 — Backend changes

- New `POST /api/projects/[id]/invoices` endpoint with the three modes.
- New `PATCH /api/projects/[id]/delivery` endpoint.
- `generate-invoice` route becomes a thin wrapper.
- Drop the 409 "one invoice per estimate" check.
- No UI change yet — old UI still works.

### 7.3 Phase 3 — Delivery & Sign-off tab

- Build the new tab component with sections A/B/C.
- Replace `project-completion-form.tsx` with the new component.
- Wire the auto-transition on sign-off to `DELIVERED`.
- Both reported bugs (post-completion lock, no participant count) are fixed at the end of this phase.

### 7.4 Phase 4 — Invoices tab

- Build `BillingMeter` shared component.
- Build new Invoices tab content with meter + invoice list + `+ New Invoice` button.
- Build `NewInvoiceSheet` modal with the three modes.
- Remove the old `GenerateInvoiceButton`.

### 7.5 Phase 5 — Status remap

- Update `src/types/index.ts` with the new enum.
- Update `StatusBadge` colors.
- Update `ProjectStatusStepper` to 7 steps.
- Update auto-transition triggers in API routes.
- One-time data migration script: `npx tsx scripts/remap-project-status.ts`.
  - Mapping is data-driven, not status-driven, so projects sit on the right rung after the remap rather than always at the lowest mapped equivalent. For each project, in this order:
    1. If `status` is currently `CLOSED` → `CLOSED`.
    2. Else if `ProjectCompletion` exists with both `internalCompleted` and `clientAcknowledged` true → `DELIVERED`.
    3. Else if current status is `IN_PROGRESS` → `IN_PROGRESS` (preserves the explicit kickoff signal).
    4. Else if any non-deleted estimate has `isApproved=true` → `APPROVED`.
    5. Else if any non-deleted estimate exists → `ESTIMATING`.
    6. Else if `Inquiry` exists with non-empty `objectives` and at least one `InquiryServiceModule` → `BRIEFED`.
    7. Else → `NEW`.
  - Supports `--dry-run` flag (default behavior is dry-run; explicit `--apply` to write).
  - Backs up pre-change rows to `prisma/backups/status-remap-YYYY-MM-DD.json` before any write.

### 7.6 Phase 6 — Project list & filters

- Update list table columns and filters to the new enum.
- Add billing subtitle to project name cell.
- Update URL query param handling.

### 7.7 Phase 7 — Cleanup

- Delete the `generate-invoice` wrapper route once no caller remains.
- Delete unused completion form component if any reference lingers.
- Audit for orphan imports.

Each phase is independently deployable. Phases 1–4 do not touch existing data; Phase 5 is the only one that mutates rows and is gated on a manual dry-run review.

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Status remap script writes wrong values to prod | Default dry-run; JSON backup of all changed rows; require explicit `--apply` flag; manual approval per project rule |
| Existing invoices have `estimateLineItemId = null` and break the slice picker's "already invoiced" rollup | Treat null as "untracked"; subtract from remaining only when the back-ref is known; show a one-line note in the sheet for affected estimates |
| User creates an invoice for more than the delivered quantity | UI prevents (input clamped to remaining); API validates and returns 422 with a clear message |
| Currency mixing in the billing meter (USD + CNY) double-counts | Meter only sums project's primary currency; secondary line shows other-currency totals separately |
| Old `generate-invoice` callers (e.g., scripts, integrations) silently use the wrapper | Wrapper logs a deprecation warning; wrapper deleted in Phase 7 only after Phase 4 ships |
| Production database integrity during the additive migration | `prisma migrate deploy` only adds nullable columns — verified safe pattern; no risk to existing rows |

## 9. Open questions

None at design time. All scope decisions documented above. Implementation plan (next document) will identify any new questions that surface from breaking phases into tasks.

## 10. References

- Brainstorming session transcript and visual mockups: `.superpowers/brainstorm/30525-1777352890/content/`
- Current schema: `prisma/schema.prisma`
- Current completion form: `src/components/projects/project-completion-form.tsx`
- Current invoice generation route: `src/app/api/projects/[id]/generate-invoice/route.ts`
- Current status enum: `src/types/index.ts`, `src/components/shared/status-badge.tsx`
