# Invoice Corrections (Admin-Only Edit on Sent/Paid Invoices) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow ADMIN users to correct any field on a sent/paid/overdue invoice (line items, discount, dates, notes, contact email) from the invoice detail page, with an explicit Edit toggle, a single Save, and a before/after activity-log entry. Non-admins see no edit affordance on non-DRAFT invoices.

**Architecture:** Three small, additive changes — (1) extend the existing `InvoiceLineEditor` so description, unit price, and row add/remove become editable; (2) tighten the PATCH route to gate non-DRAFT field-edits to ADMIN while preserving MANAGER's ability to change status only; (3) add a new client wrapper `InvoiceCorrectionShell` that toggles the non-DRAFT detail page between read-only and correction modes for admins. No schema migration, no new API route, no new enum.

**Tech Stack:** Next.js 16 App Router, React Server Components for the page, Client Components for the editor/shell, Prisma 7 PostgreSQL via `@prisma/adapter-pg`, NextAuth v5 (role read from session), Sonner for toasts, Tailwind + shadcn/ui for styling, `logActivity` helper at `src/lib/activity-log.ts`.

**Reference spec:** `docs/superpowers/specs/2026-05-14-invoice-corrections-design.md`

**No automated tests:** the project has no test framework configured. Each task ends with `npm run build` (which type-checks via Next.js) and a manual smoke check, then a commit.

---

## File Map

**Modify:**
- `src/components/invoices/invoice-line-editor.tsx` — make `description` and `unitPrice` editable, add `+ Add line` and per-row delete.
- `src/app/api/invoices/[id]/route.ts` — status-aware role gate; before/after diff metadata for non-DRAFT corrections.
- `src/app/(dashboard)/invoices/[id]/page.tsx` — read `auth()`, compute `isAdmin`, wrap non-DRAFT line-items / sidebar / header-button in `InvoiceCorrectionShell`.

**Create:**
- `src/components/invoices/invoice-correction-shell.tsx` — client wrapper that holds the `editing` state, swaps read-only vs editor blocks, and submits a single PATCH on Save.

**No changes:**
- `prisma/schema.prisma` — no schema migration.
- `src/types/index.ts` — no new enum value.
- `src/components/invoices/invoice-status-changer.tsx` — unchanged; its existing PATCH body sends `status` only and remains MANAGER-allowed.
- `src/lib/pdf/invoice-pdf.tsx` and `src/app/api/invoices/[id]/pdf/route.ts` — PDFs render from current data; corrections are reflected automatically.

---

## Task 1: Extend `InvoiceLineEditor` to allow editing description, unit price, and row add/remove

**Files:**
- Modify: `src/components/invoices/invoice-line-editor.tsx`

**Why:** Today the component only exposes `quantity` and `discount` as inputs. For the correction flow to "fix any mistake," we need editable description and unit price, plus the ability to add or remove rows. The PATCH route already replaces all line items on save, so no API change is needed for this.

- [ ] **Step 1: Add `description` text input, `unitPrice` number input, and add/remove handlers**

Replace the entire component body. The new version:
- Keeps the same props interface.
- Adds `updateDescription(idx, v)`, `updateUnitPrice(idx, v)`, `addRow()`, `removeRow(idx)` handlers.
- Renders `<Input>` for description and unit price (alongside the existing quantity input).
- Renders a trash icon button on every row (the icon is `Trash2` from `lucide-react`).
- Renders a `+ Add line` button below the table.
- Generates a temporary client-side id for newly added rows using `crypto.randomUUID()` (Prisma will assign a permanent id on save; the temporary id only needs to be unique within the working list for React keys).

Full replacement for `src/components/invoices/invoice-line-editor.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sortOrder: number;
}

interface InvoiceLineEditorProps {
  invoiceId: string;
  lineItems: LineItem[];
  discount: number;
  taxRate: number;
  currencySymbol: string;
}

export function InvoiceLineEditor({
  invoiceId,
  lineItems: initialLineItems,
  discount: initialDiscount,
  taxRate,
  currencySymbol: sym,
}: InvoiceLineEditorProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<LineItem[]>(
    initialLineItems.map((li) => ({ ...li }))
  );
  const [discount, setDiscount] = useState(initialDiscount);

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, li) => s + li.quantity * li.unitPrice, 0);
    const taxable = subtotal - discount;
    const tax = taxable * (taxRate / 100);
    return { subtotal, tax, total: taxable + tax };
  }, [items, discount, taxRate]);

  function updateDescription(idx: number, description: string) {
    setItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], description };
      return updated;
    });
  }

  function updateQuantity(idx: number, qty: number) {
    setItems((prev) => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        quantity: qty,
        total: qty * updated[idx].unitPrice,
      };
      return updated;
    });
  }

  function updateUnitPrice(idx: number, unitPrice: number) {
    setItems((prev) => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        unitPrice,
        total: updated[idx].quantity * unitPrice,
      };
      return updated;
    });
  }

  function addRow() {
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        description: "",
        quantity: 1,
        unitPrice: 0,
        total: 0,
        sortOrder: prev.length,
      },
    ]);
  }

  function removeRow(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function handleSave() {
    setSaving(true);
    try {
      const lineItems = items.map((li, idx) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        total: li.quantity * li.unitPrice,
        sortOrder: idx,
      }));

      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItems, discount }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      toast.success("Invoice updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead className="text-right w-[100px]">Qty</TableHead>
            <TableHead className="text-right w-[140px]">Unit Price</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="w-[40px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, idx) => (
            <TableRow key={item.id}>
              <TableCell>
                <Input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateDescription(idx, e.target.value)}
                  className="h-8"
                />
              </TableCell>
              <TableCell className="text-right">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={item.quantity}
                  onChange={(e) => updateQuantity(idx, parseFloat(e.target.value) || 0)}
                  className="w-20 ml-auto text-right h-8"
                />
              </TableCell>
              <TableCell className="text-right">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={item.unitPrice}
                  onChange={(e) => updateUnitPrice(idx, parseFloat(e.target.value) || 0)}
                  className="w-28 ml-auto text-right h-8"
                />
              </TableCell>
              <TableCell className="text-right text-sm font-medium">
                {sym}{fmt(item.quantity * item.unitPrice)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-red-600"
                  onClick={() => removeRow(idx)}
                  aria-label="Remove line item"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex">
        <Button variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4 mr-1" /> Add line
        </Button>
      </div>

      <div className="mt-6 pt-4 border-t">
        <div className="max-w-xs ml-auto space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium">{sym}{fmt(totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Discount</span>
            <div className="flex items-center gap-1">
              <span className="text-gray-400">{sym}</span>
              <Input
                type="number"
                min={0}
                step="any"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                className="w-24 text-right h-8"
              />
            </div>
          </div>
          {taxRate > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tax ({taxRate}%)</span>
              <span className="font-medium">{sym}{fmt(totals.tax)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between">
            <span className="font-semibold">Total</span>
            <span className="font-bold text-xl">{sym}{fmt(totals.total)}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + smoke**

Run: `npm run build`
Expected: clean build, no TypeScript errors.

Then start dev server (`npm run dev`), navigate to a DRAFT invoice's detail page, and verify:
- You can edit description text in a row.
- You can change unit price; the row total updates live.
- The `+ Add line` button appends a blank row.
- The trash icon removes a row.
- Save Changes still works; refresh shows persisted data.

- [ ] **Step 3: Commit**

```bash
git add src/components/invoices/invoice-line-editor.tsx
git commit -m "feat(invoices): make description, unit price, and row add/remove editable in line editor"
```

---

## Task 2: Tighten PATCH role gate — status-aware with correction-vs-status carve-out

**Files:**
- Modify: `src/app/api/invoices/[id]/route.ts`

**Why:** Today PATCH allows `ADMIN | MANAGER` for any change at any status. We want non-DRAFT field corrections to be ADMIN-only, while keeping MANAGER's ability to change status (e.g. mark SENT or PAID) on non-DRAFT invoices.

- [ ] **Step 1: Move the existing user-id capture so we still log activity, and read the invoice before deciding required roles**

The current handler calls `requireAuth(["ADMIN", "MANAGER"])` first and looks up `existing` afterwards. Flip the order so we can decide the required roles based on `existing.status` and the request body.

Replace the top of the PATCH handler (currently lines 40–56) with this version. Keep everything from `const invoice = await prisma.$transaction…` onward unchanged.

```ts
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, issuedDate, dueDate, notes, contactEmail, discount, lineItems } = body;

    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Status-aware role gate. Status-only PATCH stays open to MANAGER even on
    // non-DRAFT invoices (so MANAGER can still mark invoices SENT/PAID/OVERDUE).
    // Any "correction" field on a non-DRAFT invoice requires ADMIN.
    const correctionFields = { lineItems, discount, issuedDate, dueDate, notes, contactEmail };
    const isCorrection = Object.values(correctionFields).some((v) => v !== undefined);
    const isDraft = existing.status === "DRAFT";
    const requiredRoles: Array<"ADMIN" | "MANAGER"> =
      isDraft || !isCorrection ? ["ADMIN", "MANAGER"] : ["ADMIN"];

    const authResult = await requireAuth(requiredRoles);
    if (isAuthError(authResult)) return authResult;
    const { userId } = authResult;
```

The variable names match the existing destructured body, so the rest of the handler keeps working without other changes.

- [ ] **Step 2: Type-check + smoke**

Run: `npm run build`
Expected: clean build.

Manually verify by logging in:
- As ADMIN, edit a SENT invoice's discount in the line editor (after Task 4/5 the UI exists; for now, you can `curl` the API): expect 200.
- As MANAGER, attempt the same: expect 403.
- As MANAGER, change a SENT invoice's status (use the existing status changer in the UI): expect 200 / status change persists.

(If you want a quick API smoke without the UI for the editor path yet, you can run something like:
```bash
curl -X PATCH http://localhost:3000/api/invoices/<id> \
  -H "Content-Type: application/json" \
  -b "<session cookie>" \
  -d '{"discount": 100}'
```
Replace `<id>` and supply your session cookie. Expect 403 as MANAGER, 200 as ADMIN, for a non-DRAFT invoice.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/invoices/[id]/route.ts
git commit -m "feat(invoices): gate non-DRAFT corrections to ADMIN; keep status-only PATCH open to MANAGER"
```

---

## Task 3: Record a before/after diff in the activity log for non-DRAFT corrections

**Files:**
- Modify: `src/app/api/invoices/[id]/route.ts`

**Why:** The spec calls for audit visibility into corrections. The existing handler already logs an `UPDATE` with no metadata; replace it with a more useful entry whose description and `metadata` reflect what changed.

- [ ] **Step 1: Compute a diff inside the existing `else` branch of the log block**

The current code (lines 128–138) is:

```ts
} else {
  await logActivity({
    action: "UPDATE",
    entityType: "INVOICE",
    entityId: id,
    entityLabel: existing.invoiceNumber,
    description: `Updated invoice ${existing.invoiceNumber}`,
    userId,
    projectId: existing.projectId,
  });
}
```

Replace that block with the following. It builds a `changes` object that captures only the fields that actually changed, distinguishes a "correction" (non-DRAFT) from a normal "update" (DRAFT), and records a boolean `lineItemsChanged` rather than a full line-item diff to keep the log readable.

```ts
} else {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (discount !== undefined && discount !== existing.discount) {
    changes.discount = { from: existing.discount, to: discount };
  }
  if (issuedDate !== undefined) {
    const toIso = issuedDate ? new Date(issuedDate).toISOString() : null;
    const fromIso = existing.issuedDate ? existing.issuedDate.toISOString() : null;
    if (toIso !== fromIso) changes.issuedDate = { from: fromIso, to: toIso };
  }
  if (dueDate !== undefined) {
    const toIso = dueDate ? new Date(dueDate).toISOString() : null;
    const fromIso = existing.dueDate ? existing.dueDate.toISOString() : null;
    if (toIso !== fromIso) changes.dueDate = { from: fromIso, to: toIso };
  }
  if (notes !== undefined && notes !== existing.notes) {
    changes.notes = { from: existing.notes, to: notes };
  }
  if (contactEmail !== undefined && contactEmail !== existing.contactEmail) {
    changes.contactEmail = { from: existing.contactEmail, to: contactEmail };
  }
  if (lineItems && Array.isArray(lineItems)) {
    changes.lineItemsChanged = { from: false, to: true };
    // The transaction above already recomputed subtotal/tax/total when
    // lineItems were sent; surface the new total alongside the old.
    changes.total = { from: existing.total, to: invoice.total };
  } else if (discount !== undefined && discount !== existing.discount) {
    changes.total = { from: existing.total, to: invoice.total };
  }

  const wasDraft = existing.status === "DRAFT";
  await logActivity({
    action: "UPDATE",
    entityType: "INVOICE",
    entityId: id,
    entityLabel: existing.invoiceNumber,
    description: wasDraft
      ? `Updated invoice ${existing.invoiceNumber}`
      : `Corrected invoice ${existing.invoiceNumber}`,
    metadata: Object.keys(changes).length > 0 ? changes : undefined,
    userId,
    projectId: existing.projectId,
  });
}
```

Note that `logActivity`'s `metadata` parameter expects a plain object (it serializes to JSON internally); pass it directly. If `logActivity`'s signature does not accept `metadata: undefined`, drop the key entirely when `changes` is empty (use a small conditional spread instead).

- [ ] **Step 2: Verify `logActivity`'s signature accepts the metadata shape**

Run: `npm run build`

If TypeScript complains about the `metadata` type, open `src/lib/activity-log.ts`, check the parameter type, and either (a) widen the local `changes` type to match (e.g. `Record<string, unknown>` or whatever the helper accepts), or (b) `JSON.stringify(changes)` before passing if the helper expects a string. Adjust the call site only; do not change `activity-log.ts`.

- [ ] **Step 3: Smoke check**

Start dev server, log in as ADMIN, open Prisma Studio (`npx prisma studio`) on the `ActivityLog` table. From the UI (after Task 5 lands you can use the editor; for now you can use `curl` again) change discount on a SENT invoice. A new `ActivityLog` row should appear with `action: "UPDATE"`, `description: "Corrected invoice INV-…"`, and a JSON `metadata` value containing `discount` and `total` before/after.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/invoices/[id]/route.ts
git commit -m "feat(invoices): log before/after diff when correcting non-DRAFT invoices"
```

---

## Task 4: Create `InvoiceCorrectionShell` client wrapper

**Files:**
- Create: `src/components/invoices/invoice-correction-shell.tsx`

**Why:** The invoice detail page is a server component. To toggle between read-only and correction modes we need a small client component that holds the `editing` boolean and the working copy of metadata fields (line items + discount are owned by `InvoiceLineEditor`; everything else lives here). It submits a single PATCH on Save covering the metadata fields, and lets `InvoiceLineEditor` handle line items + discount via its own existing Save Changes button.

This split is deliberate: line items + discount have their own complex local state (typed inputs, totals), and the existing editor already handles them well. The shell takes care of the page-level chrome (Edit / Cancel / Save metadata) and the simpler scalar fields.

- [ ] **Step 1: Write the file**

Create `src/components/invoices/invoice-correction-shell.tsx`:

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, X, Loader2, Save, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InvoiceLineEditor } from "@/components/invoices/invoice-line-editor";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sortOrder: number;
}

interface InvoiceCorrectionShellProps {
  invoiceId: string;
  isAdmin: boolean;
  // Line items + totals
  lineItems: LineItem[];
  discount: number;
  taxRate: number;
  currencySymbol: string;
  // Metadata
  issuedDate: string | null; // ISO date or null
  dueDate: string | null;
  notes: string | null;
  contactEmail: string | null;
  // Read-only blocks (rendered by the server page) shown when not editing
  readOnlyLineItemsBlock: ReactNode;
  readOnlyTotalsBlock: ReactNode;
  readOnlyMetadataBlock: ReactNode; // the sidebar fields the server page already renders
}

export function InvoiceCorrectionShell({
  invoiceId,
  isAdmin,
  lineItems,
  discount,
  taxRate,
  currencySymbol,
  issuedDate: initialIssuedDate,
  dueDate: initialDueDate,
  notes: initialNotes,
  contactEmail: initialContactEmail,
  readOnlyLineItemsBlock,
  readOnlyTotalsBlock,
  readOnlyMetadataBlock,
}: InvoiceCorrectionShellProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [issuedDate, setIssuedDate] = useState(initialIssuedDate ?? "");
  const [dueDate, setDueDate] = useState(initialDueDate ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [contactEmail, setContactEmail] = useState(initialContactEmail ?? "");

  function cancel() {
    setIssuedDate(initialIssuedDate ?? "");
    setDueDate(initialDueDate ?? "");
    setNotes(initialNotes ?? "");
    setContactEmail(initialContactEmail ?? "");
    setEditing(false);
  }

  async function saveMetadata() {
    setSavingMeta(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issuedDate: issuedDate || null,
          dueDate: dueDate || null,
          notes: notes || null,
          contactEmail: contactEmail || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      toast.success("Invoice details updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSavingMeta(false);
    }
  }

  // Non-admins or non-edit state: render the read-only blocks as-is.
  if (!isAdmin || !editing) {
    return (
      <>
        {isAdmin && (
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Button>
          </div>
        )}
        {readOnlyLineItemsBlock}
        {readOnlyTotalsBlock}
        {readOnlyMetadataBlock}
      </>
    );
  }

  // Admin + editing: show warning, line editor, metadata form.
  return (
    <>
      <div
        className="flex items-start gap-2 px-4 py-3 rounded-lg mb-4"
        style={{ background: "#FFF7E6", border: "1px solid #F5C97A" }}
      >
        <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 flex-shrink-0" />
        <div className="text-[12px] text-amber-900 leading-[1.4]">
          Editing a sent invoice. Saving will update the totals on the PDF and in the project&apos;s
          billing summary. Activity will be recorded.
        </div>
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={cancel}>
            <X className="h-3.5 w-3.5 mr-1" /> Cancel
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
            {"// LINE ITEMS · CORRECTION"}
          </p>
          <div
            className="bg-card-rd rounded-[14px] p-5"
            style={{
              border: "1px solid var(--color-hairline)",
              boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
            }}
          >
            <InvoiceLineEditor
              invoiceId={invoiceId}
              lineItems={lineItems}
              discount={discount}
              taxRate={taxRate}
              currencySymbol={currencySymbol}
            />
          </div>
        </div>

        <div>
          <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
            {"// DETAILS · CORRECTION"}
          </p>
          <div
            className="bg-card-rd rounded-[14px] p-5 space-y-3"
            style={{
              border: "1px solid var(--color-hairline)",
              boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
            }}
          >
            <label className="block">
              <span className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-1">
                Issued date
              </span>
              <Input
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
                className="h-8"
              />
            </label>
            <label className="block">
              <span className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-1">
                Due date
              </span>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-8"
              />
            </label>
            <label className="block">
              <span className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-1">
                Contact email
              </span>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="h-8"
              />
            </label>
            <label className="block">
              <span className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-1">
                Notes
              </span>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </label>
            <div className="flex justify-end pt-2">
              <Button onClick={saveMetadata} disabled={savingMeta} size="sm">
                {savingMeta ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save details
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
```

Notes:
- The shell takes the existing read-only blocks as `ReactNode` props rather than re-implementing them. That way the page's existing markup is not duplicated; only the toggle behaviour is new.
- Line items + discount are saved by the inner `InvoiceLineEditor`'s own Save Changes button. The shell's own "Save details" button saves only the metadata fields. Two separate saves keep each form's local state independent and avoid duplicating `InvoiceLineEditor`'s state inside the shell.
- The dates are stored as `YYYY-MM-DD` strings from the `<input type="date">` and sent as-is to the API, which already parses them with `new Date(...)`.
- `Textarea` is a shadcn component. If it is not already installed in the project, add it: `npx shadcn@latest add textarea --yes`. Run this before the type-check step below if `Textarea` is not importable.

- [ ] **Step 2: Confirm `Textarea` is available**

Run: `ls src/components/ui/textarea.tsx`

If the file does not exist:

```bash
npx shadcn@latest add textarea --yes
```

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add src/components/invoices/invoice-correction-shell.tsx src/components/ui/textarea.tsx 2>/dev/null || git add src/components/invoices/invoice-correction-shell.tsx
git commit -m "feat(invoices): add InvoiceCorrectionShell client wrapper for admin corrections"
```

---

## Task 5: Wire `InvoiceCorrectionShell` into the invoice detail page

**Files:**
- Modify: `src/app/(dashboard)/invoices/[id]/page.tsx`

**Why:** The detail page currently shows non-DRAFT invoices read-only with no edit affordance. Wrap the line-items / totals / sidebar-metadata blocks in `InvoiceCorrectionShell` and pass `isAdmin` so admins get the Edit toggle.

- [ ] **Step 1: Add `auth()` and compute `isAdmin`**

At the top of the page module, add imports:

```ts
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InvoiceCorrectionShell } from "@/components/invoices/invoice-correction-shell";
```

Inside `InvoiceDetailPage`, immediately after `const { id } = await params;`, insert:

```ts
const session = await auth();
if (!session?.user) redirect("/login");
const isAdmin = (session?.user as { role?: string })?.role === "ADMIN";
```

This matches the pattern used in `src/app/(dashboard)/projects/[id]/page.tsx:27-72`.

- [ ] **Step 2: Refactor the non-DRAFT branch to use the shell**

The current `isDraft ? <inline DRAFT editor> : <read-only line items + totals>` block lives at roughly lines 131–268 of the page. The DRAFT branch stays as today. Replace the entire `else` branch (the read-only line-items card + totals card) with a single `<InvoiceCorrectionShell>` call that receives the existing read-only markup as props.

Concretely, restructure the non-DRAFT branch like this. Extract the existing read-only line-items grid, totals card, and the entire `// DETAILS` sidebar card into local JSX variables, then pass them to the shell:

```tsx
) : (
  (() => {
    const readOnlyLineItemsBlock = (
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
          {/* existing column-header band + line item rows go here verbatim */}
          {/* (copy the grid header div and the .map(...) over invoice.lineItems
              from the current page exactly as written — do not retype) */}
        </div>
      </div>
    );

    const readOnlyTotalsBlock = (
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
          {/* existing totals JSX (subtotal / discount / tax / total) goes here verbatim */}
        </div>
      </div>
    );

    // The sidebar's read-only DETAILS card is NOT moved into the shell — it lives
    // in the sidebar column, which the shell does not touch. The shell renders
    // the editable date / email / notes fields in correction mode itself.
    // Pass an empty fragment so the prop is satisfied.
    const readOnlyMetadataBlock = null;

    return (
      <InvoiceCorrectionShell
        invoiceId={invoice.id}
        isAdmin={isAdmin}
        lineItems={invoice.lineItems.map((li) => ({
          id: li.id,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          total: li.total,
          sortOrder: li.sortOrder,
        }))}
        discount={invoice.discount}
        taxRate={invoice.taxRate}
        currencySymbol={sym}
        issuedDate={invoice.issuedDate ? invoice.issuedDate.toISOString().slice(0, 10) : null}
        dueDate={invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : null}
        notes={invoice.notes}
        contactEmail={invoice.contactEmail}
        readOnlyLineItemsBlock={readOnlyLineItemsBlock}
        readOnlyTotalsBlock={readOnlyTotalsBlock}
        readOnlyMetadataBlock={readOnlyMetadataBlock}
      />
    );
  })()
)}
```

When you actually edit the file, copy the existing JSX for `readOnlyLineItemsBlock` and `readOnlyTotalsBlock` verbatim from the current page — those blocks already exist in `src/app/(dashboard)/invoices/[id]/page.tsx` at roughly lines 165–268. The shell renders them as `{children}` when not editing.

Decisions baked into this wiring:
- The existing sidebar `// DETAILS` card (client / project / contact / issued / due / paid / exchange-rate / RMB-duplicate links) stays in place in the sidebar column. The shell does not move or replace it.
- In correction mode, the shell renders its own `// DETAILS · CORRECTION` card with the editable date / contact email / notes fields. That card appears in the main column, below the line-items card, only while editing. When the admin clicks Cancel or completes their save, the page refreshes and the read-only sidebar card reflects the new values.

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 4: Smoke test in the browser**

Start dev server (`npm run dev`).

1. Log in as ADMIN. Open a SENT or PAID invoice.
2. Verify the "Edit" button appears at the top-right of the line-items / totals column. (The header buttons — InvoiceStatusChanger, CreateRmbInvoiceButton, PDF — are still present in the page header.)
3. Click Edit. Warning strip appears; the line-items grid swaps to the editable `InvoiceLineEditor`; a `// DETAILS · CORRECTION` card appears underneath with editable date / email / notes fields.
4. Change a line item's quantity → click Save Changes inside the line editor → toast appears, page refreshes, totals updated. Activity log entry recorded (check Prisma Studio if you want).
5. Click Edit again, change the due date → click Save details → toast appears, page refreshes, sidebar "Due" date updated.
6. Cancel button exits correction mode without saving.
7. Download the PDF — totals reflect the new values.
8. Log out, log in as MANAGER. Open the same invoice. No Edit button visible. The InvoiceStatusChanger and PDF buttons remain visible and functional.
9. As MANAGER, click the status changer to mark the invoice PAID (or revert) — that still works.
10. Open a DRAFT invoice as MANAGER. Inline line editor is shown as before (regression check).

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/invoices/[id]/page.tsx
git commit -m "feat(invoices): wire InvoiceCorrectionShell into invoice detail page for admin corrections"
```

---

## Task 6: Final manual verification + push

**Files:** None.

- [ ] **Step 1: Run the full spec test plan**

Run through every item in the "Test plan" section of `docs/superpowers/specs/2026-05-14-invoice-corrections-design.md`:

1. ADMIN on SENT invoice: Edit button → editor → quantity change → activity log "Corrected invoice…" with diff → PDF reflects new total.
2. ADMIN on PAID invoice: same flow; `paidDate` preserved (not reset). Verify by editing then checking the sidebar still shows the original paid date.
3. MANAGER on SENT invoice: no Edit button; status-changer (Mark Paid / Mark Sent) still works.
4. MANAGER on DRAFT invoice: line editor inline as today (regression check).
5. VIEWER on any invoice: no Edit button anywhere (existing behaviour, regression check).
6. Direct PATCH as MANAGER to a SENT invoice with `{"discount": 100}` → 403. Test with curl using a MANAGER session cookie.
7. Direct PATCH as MANAGER to a SENT invoice with `{"status": "PAID"}` → 200. Same cookie.
8. RMB duplicate: edit the parent's line items → open the RMB duplicate → its line items unchanged (no propagation, as designed).

- [ ] **Step 2: Final build**

Run: `npm run build`
Expected: clean build. Lint: `npm run lint` → no new errors.

- [ ] **Step 3: Push to remote**

```bash
git push origin main
```

Production deploy follows the procedure in `CLAUDE.md` — this change has no schema migration, so the migration step in the deploy flow is a no-op.

---

## Self-review notes

- **Spec coverage:** §1 (admin-only edit on SENT/PAID/OVERDUE) → Tasks 4–5. §1a (extended line editor) → Task 1. §2 (status-aware role gate with status-only carve-out) → Task 2. §3 (activity log diff) → Task 3. §4 (PDF / RMB / billing-summary auto-reflect) → covered by existing rendering paths; verified in Task 5/6 smoke checks. §5 ("what does not change") → no migration tasks added, no enum changes, no estimate/project/feedback touch.
- **Type consistency:** `InvoiceCorrectionShell` props match what `InvoiceDetailPage` passes in Task 5 (lineItems shape mirrors the existing `InvoiceLineEditor` props). `requiredRoles` typed as `Array<"ADMIN" | "MANAGER">` to match `requireAuth`'s `Role` union.
- **No placeholders:** All code blocks are complete. The "copy existing JSX verbatim" instruction in Task 5 is a deliberate concession to avoid duplicating 100+ lines of grid markup — the source is the page file the engineer is already editing.
