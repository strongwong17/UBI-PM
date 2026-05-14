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
