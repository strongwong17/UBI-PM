# Invoice Corrections (Admin-Only Edit on Sent/Paid Invoices)

**Date:** 2026-05-14
**Status:** Approved (pending user review of this spec)

## Problem

Today the Invoice detail page (`src/app/(dashboard)/invoices/[id]/page.tsx`) only exposes the line-item editor when the invoice is in `DRAFT` status. Once an invoice moves to `SENT`, `PAID`, or `OVERDUE`, the page renders the line items, totals, and metadata read-only — there is no UI affordance to fix a typo, a wrong quantity, an incorrect unit price, a wrong discount, a wrong due date, or a wrong contact email.

The PATCH route `src/app/api/invoices/[id]/route.ts` already accepts edits to line items, discount, dates, notes, contact email, and status at any status — it gates on role (`ADMIN` or `MANAGER`) but not on status. So the gap is purely in the UI: the backend can correct an invoice, the frontend just doesn't ask.

Net effect: when a sent invoice is wrong, the only practical workarounds today are (a) issue a duplicate and live with two records, or (b) edit rows directly in Prisma Studio. Both are bad.

## Goals

1. ADMIN users can correct any field of a sent/paid/overdue invoice from the invoice detail page — line items (description, quantity, unit price), discount, issued date, due date, notes, and contact email.
2. MANAGER and VIEWER users see **no** edit affordance on non-DRAFT invoices. They contact the admin out-of-band (email, chat, etc.) to request a correction. No in-app request flow.
3. MANAGER retains the ability to edit DRAFT invoices, exactly as today.
4. Every correction to a non-DRAFT invoice is recorded in the activity log with a before/after diff so the change is auditable.
5. PDFs reflect corrections automatically (they already render on demand from current data).

## Non-goals

- No in-app correction-request / notification / inbox system. Non-admins use external channels.
- No email infrastructure. The project has none today; adding it is out of scope.
- No automatic propagation of corrections from a parent invoice to its RMB duplicate. If both need correcting, the admin corrects both (or recreates the duplicate). Auto-propagation would entangle two records with subtly different totals and isn't worth it for this scope.
- No new invoice status (e.g. `CORRECTED`). Status semantics stay as today; the correction is just a normal `UPDATE`.
- No "credit note" / "amendment record" pattern. This is direct in-place editing — appropriate for a small internal tool where the official document is whatever PDF was last sent and corrections are rare/manual.
- No client-facing notification that the invoice changed. That's a manual workflow ("send the updated PDF to the client") owned by the admin.

## Design

### 1. UI — read-only by default, explicit "Edit" toggle for admins

The current invoice detail page has two branches:

- `isDraft === true` → renders the inline `InvoiceLineEditor` plus editable fields.
- otherwise → renders read-only line items and totals.

Change this to a three-state model on the same page (no new route):

- **Draft, any editor (ADMIN/MANAGER):** unchanged. Inline editor as today (`InvoiceLineEditor`, with its existing explicit "Save Changes" button).
- **Non-draft, non-admin (MANAGER / VIEWER):** unchanged. Read-only.
- **Non-draft, admin:** read-only by default, with an **"Edit"** button placed in the header action row (next to the existing `InvoiceStatusChanger` / PDF buttons). Clicking it toggles the page into **correction mode**:
  - Line items + totals card swaps from the read-only grid to the (extended — see §1a) `InvoiceLineEditor`.
  - Sidebar fields (issued date, due date, contact email, notes) swap to editable inputs.
  - A warning strip appears at the top of the main column:
    > ⚠ Editing a sent invoice. Saving will update the totals on the PDF and in the project's billing summary. Activity will be recorded.
  - The "Edit" button becomes **"Cancel"** (exits correction mode and reverts any unsaved changes). A single **"Save corrections"** button at the bottom of the main column commits all changes — line items, discount, and metadata — in one PATCH call.

The toggle is explicit on purpose: it prevents accidental edits when an admin is just opening the invoice to read it, and visually communicates "you are now modifying an official document."

**Implementation:**

- The detail page is currently a server component. Correction mode needs client state, so introduce a client wrapper `InvoiceCorrectionShell` (in `src/components/invoices/invoice-correction-shell.tsx`) that:
  - Holds the `editing` boolean and the working copy of all editable fields.
  - Renders the read-only blocks (line items grid, totals, sidebar fields) or the editor blocks based on `editing`.
  - Renders the Edit / Cancel / Save corrections buttons.
  - On Save, issues a single PATCH carrying line items, discount, issuedDate, dueDate, notes, contactEmail.
- The wrapper consumes the existing read-only markup for non-editing state by accepting it as children/props, so the page's existing rendering isn't duplicated.
- Pass `isAdmin` from the server page (computed from `session.user.role`) down to the shell. Non-admins on non-DRAFT never see the Edit button — the shell simply renders the read-only state and returns without a toggle.
- DRAFT continues to render `InvoiceLineEditor` inline (no toggle needed), as today. The shell short-circuits for DRAFT and is not used in that path.

### 1a. Extend `InvoiceLineEditor` so all line-item fields are editable

Today `InvoiceLineEditor` only exposes `quantity` and `discount` as inputs; `description` and `unitPrice` are read-only display values, and there is no way to add or remove rows. For a "fix any mistake" correction flow that's not enough.

Extend the component:
- **Description** → text input.
- **Unit price** → number input (same style as quantity).
- **Add line item** → a `+ Add line` button at the bottom of the table that appends a new row (description = "", quantity = 1, unitPrice = 0, total = 0).
- **Remove line item** → a small trash icon at the end of each row.

For DRAFT invoices this is a nice-to-have improvement that doesn't break existing behaviour (the same PATCH endpoint already accepts arbitrary line items). For non-DRAFT corrections it's required. The same component is used in both contexts — no separate "correction editor."

The PATCH route already replaces all line items on save (`deleteMany` + `createMany`), so add/remove falls out naturally; no API change needed for this part.

### 2. API — status-aware role gate on PATCH

`src/app/api/invoices/[id]/route.ts` currently requires `ADMIN` or `MANAGER` for PATCH at any status. Tighten this:

```ts
const existing = await prisma.invoice.findUnique({ where: { id } });
if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

const isDraft = existing.status === "DRAFT";
const requiredRoles = isDraft ? ["ADMIN", "MANAGER"] : ["ADMIN"];
const authResult = await requireAuth(requiredRoles);
if (isAuthError(authResult)) return authResult;
```

This means:
- DRAFT invoices: ADMIN or MANAGER can edit (unchanged).
- SENT / PAID / OVERDUE invoices: ADMIN only.

The check uses `existing.status` (the persisted value), so a MANAGER cannot include `status: "DRAFT"` in their request body to bypass the gate.

**Note** on the existing flow: the `InvoiceStatusChanger` is a separate path and already uses the same PATCH endpoint. After this change, a MANAGER can no longer change the status of a non-DRAFT invoice (e.g. SENT → PAID). That's a regression we don't want, since MANAGER marking invoices PAID is a common normal-flow action. **Mitigation:** in the PATCH handler, if the body is *only* a status change (no line items, discount, dates, notes, contactEmail), keep the auth at `["ADMIN", "MANAGER"]`. Only the field-correction path bumps to ADMIN-only. Concretely:

```ts
const correctionKeys = ["lineItems", "discount", "issuedDate", "dueDate", "notes", "contactEmail"];
const isCorrection = correctionKeys.some((k) => body[k] !== undefined);
const isDraft = existing.status === "DRAFT";
const requiredRoles = isDraft || !isCorrection ? ["ADMIN", "MANAGER"] : ["ADMIN"];
```

This preserves MANAGER's ability to mark invoices PAID/SENT/OVERDUE (status-only PATCH) without granting them field-correction rights on non-DRAFT invoices.

### 3. Activity log — before/after diff for corrections

The PATCH handler currently logs `UPDATE` with no metadata when fields change, and `STATUS_CHANGE` (with from/to metadata) when status changes. Extend it so that a field-edit on a non-DRAFT invoice records what changed:

- Action: keep `UPDATE` (no new action type — keeps the activity feed simple).
- Description: `"Corrected invoice {invoiceNumber}"` instead of `"Updated invoice {invoiceNumber}"` when the original status was not DRAFT.
- Metadata: a JSON object capturing the before/after for any of these that changed: `subtotal`, `discount`, `tax`, `total`, `issuedDate`, `dueDate`, `notes`, `contactEmail`, and `lineItemsChanged: true | false` (a boolean — full line-item diffs would be noisy; the project's activity feed isn't a forensic tool).

The diff is computed inside the existing `prisma.$transaction` so the metadata reflects the same atomic update.

### 4. PDF, RMB duplicate, project billing summary

- **PDF** (`/api/invoices/[id]/pdf`) — no change. Renders from current invoice data on every request; the next download after a correction is automatically correct.
- **RMB duplicate** — no auto-propagation. If both need correcting, the admin opens the duplicate and corrects it too (it's also non-DRAFT, so the same Edit button appears). The "Original" / "RMB Duplicate" sidebar links already make navigation between them one click.
- **Project billing summary** (`BillingSummary` on the Project Hub's Invoices tab) — already computes totals from the invoice rows it reads, so it reflects corrections automatically.

### 5. What does *not* change

- No schema migration. No new Prisma model, no new column.
- No new enum values.
- No changes to estimates, projects, completion, feedback, or any other entity.
- No changes to the Send-invoice page.
- DRAFT editing UX is untouched.

## Risks / open considerations

- **Accidental edits.** Mitigated by the explicit Edit toggle and the warning strip. Worst case, an admin edits then immediately edits back; the activity log captures both.
- **Out-of-sync paper trail.** If the admin corrects an invoice after the client has paid based on the old PDF, the totals will no longer match what was actually billed. This is a manual-process concern — the admin needs to communicate with the client and decide whether to refund/recharge. The tool doesn't try to enforce this; the activity log entry is the audit trail.
- **MANAGER status-change carve-out.** The carve-out in §2 is the one fiddly bit. A MANAGER who tries to combine `status: "PAID"` with any correction field (lineItems, discount, issuedDate, dueDate, notes, contactEmail) in the same PATCH on a non-DRAFT invoice gets a 403. The status-changer component only sends status, so this is fine in practice — but worth a quick check that no other call site bundles status with correction fields. (Spot-checked: `InvoiceStatusChanger` and `InvoiceLineEditor` are the only PATCH callers; status-changer sends `status` only, line-editor sends lineItems/discount only.)

## Test plan

No test framework is configured for this project, so this is a manual checklist:

1. As ADMIN on a SENT invoice: Edit button visible → click → editor appears with warning strip → change a quantity, blur → totals update, activity log entry "Corrected invoice INV-…" with metadata diff → PDF downloads with new total.
2. As ADMIN on a PAID invoice: same flow works; paidDate is preserved (not reset).
3. As MANAGER on a SENT invoice: no Edit button visible; status-changer (Mark Paid) still works.
4. As MANAGER on a DRAFT invoice: line editor works inline as today (regression check).
5. As VIEWER on any invoice: read-only, no Edit button anywhere (existing behaviour, regression check).
6. Direct PATCH as MANAGER to a SENT invoice with `{ discount: 100 }` → 403.
7. Direct PATCH as MANAGER to a SENT invoice with `{ status: "PAID" }` → 200.
8. RMB duplicate: edit the parent → child is unchanged (no propagation, as designed).
