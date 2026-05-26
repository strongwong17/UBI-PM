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
import { Loader2, Save } from "lucide-react";

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

  function updateQuantity(idx: number, qty: number) {
    setItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], quantity: qty, total: qty * updated[idx].unitPrice };
      return updated;
    });
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
            <TableHead className="text-right w-[120px]">Qty</TableHead>
            <TableHead className="text-right">Unit Price</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, idx) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium text-sm">{item.description}</TableCell>
              <TableCell className="text-right">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={item.quantity}
                  onChange={(e) => updateQuantity(idx, parseFloat(e.target.value) || 0)}
                  className="w-24 ml-auto text-right h-8"
                />
              </TableCell>
              <TableCell className="text-right text-sm">
                {sym}{fmt(item.unitPrice)}
              </TableCell>
              <TableCell className="text-right text-sm font-medium">
                {sym}{fmt(item.quantity * item.unitPrice)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

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
