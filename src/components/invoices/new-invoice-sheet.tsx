// src/components/invoices/new-invoice-sheet.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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
import { currencySymbol } from "@/lib/currency";

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
  const sym = estimate ? currencySymbol(estimate.currency) : "$";

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
  useEffect(() => setBillQty(initialQty), [initialQty]);

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
