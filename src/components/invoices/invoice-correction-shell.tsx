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
      setEditing(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSavingMeta(false);
    }
  }

  // Non-admins or non-edit state: render the read-only blocks as-is.
  // The early return keeps the editing/non-editing subtrees as distinct React
  // identities, so InvoiceLineEditor remounts on every Edit/Cancel cycle and its
  // local line-item/discount state resets to props — do not merge the branches.
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
          Editing a non-draft invoice. Saving will update the totals on the PDF and in the project&apos;s
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
