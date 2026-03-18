"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, FileText, CheckCircle2 } from "lucide-react";

interface EstimateLineItem {
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

interface EstimatePhase {
  name: string;
  lineItems: EstimateLineItem[];
}

interface ApprovedEstimate {
  id: string;
  estimateNumber: string;
  title: string;
  label: string | null;
  currency: string;
  taxRate: number;
  discount: number;
  phases: EstimatePhase[];
  hasInvoice: boolean;
  parentEstimateId: string | null;
}

interface ProjectCompletionFormProps {
  projectId: string;
  projectStatus: string;
  approvedEstimates: ApprovedEstimate[];
  hasInvoices: boolean;
  initialData?: {
    internalCompleted?: boolean;
    internalCompletedAt?: string | null;
    internalNotes?: string | null;
    clientAcknowledged?: boolean;
    clientAcknowledgedAt?: string | null;
    clientAcknowledgedBy?: string | null;
    clientAcknowledgeNotes?: string | null;
    deliverablesNotes?: string | null;
    internalCompletedBy?: { name: string } | null;
  } | null;
}

// Flatten estimate phases into a single line item list
function flattenEstimate(est: ApprovedEstimate) {
  const items: { description: string; unit: string; quantity: number; unitPrice: number }[] = [];
  for (const phase of est.phases) {
    for (const li of phase.lineItems) {
      items.push({
        description: li.description,
        unit: li.unit,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
      });
    }
  }
  return items;
}

export function ProjectCompletionForm({
  projectId,
  projectStatus,
  approvedEstimates,
  hasInvoices,
  initialData,
}: ProjectCompletionFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Only show original estimates (not RMB duplicates) that don't have an invoice yet
  const pendingEstimates = approvedEstimates.filter(
    (est) => !est.parentEstimateId && !est.hasInvoice
  );

  // Track editable line items per estimate
  const [estimateEdits, setEstimateEdits] = useState<
    Record<string, { items: { description: string; unit: string; quantity: number; unitPrice: number }[]; discount: number }>
  >(() => {
    const edits: Record<string, { items: { description: string; unit: string; quantity: number; unitPrice: number }[]; discount: number }> = {};
    for (const est of pendingEstimates) {
      edits[est.id] = {
        items: flattenEstimate(est),
        discount: est.discount,
      };
    }
    return edits;
  });

  const [form, setForm] = useState({
    internalCompleted: initialData?.internalCompleted ?? false,
    internalNotes: initialData?.internalNotes ?? "",
    clientAcknowledged: initialData?.clientAcknowledged ?? false,
    clientAcknowledgedBy: initialData?.clientAcknowledgedBy ?? "",
    clientAcknowledgeNotes: initialData?.clientAcknowledgeNotes ?? "",
    deliverablesNotes: initialData?.deliverablesNotes ?? "",
  });

  // Calculate totals per estimate
  const estimateTotals = useMemo(() => {
    const totals: Record<string, { subtotal: number; tax: number; total: number }> = {};
    for (const est of pendingEstimates) {
      const edit = estimateEdits[est.id];
      if (!edit) continue;
      const subtotal = edit.items.reduce((s, li) => s + li.quantity * li.unitPrice, 0);
      const taxable = subtotal - edit.discount;
      const tax = taxable * (est.taxRate / 100);
      totals[est.id] = { subtotal, tax, total: taxable + tax };
    }
    return totals;
  }, [estimateEdits, pendingEstimates]);

  function updateLineItem(estimateId: string, idx: number, quantity: number) {
    setEstimateEdits((prev) => {
      const edit = { ...prev[estimateId] };
      const items = [...edit.items];
      items[idx] = { ...items[idx], quantity };
      edit.items = items;
      return { ...prev, [estimateId]: edit };
    });
  }

  function updateDiscount(estimateId: string, discount: number) {
    setEstimateEdits((prev) => ({
      ...prev,
      [estimateId]: { ...prev[estimateId], discount },
    }));
  }

  async function handleGenerateInvoice(estimateId: string) {
    const edit = estimateEdits[estimateId];
    const est = pendingEstimates.find((e) => e.id === estimateId);
    if (!edit || !est) return;

    setGenerating(true);
    try {
      // 1. Generate invoice from the estimate (uses original quantities)
      const genRes = await fetch(`/api/projects/${projectId}/generate-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateId }),
      });
      if (!genRes.ok) {
        const data = await genRes.json();
        throw new Error(data.error || "Failed to generate invoice");
      }
      const invoice = await genRes.json();

      // 2. Patch the invoice with the adjusted line items and discount
      const lineItems = edit.items.map((li, idx) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        total: li.quantity * li.unitPrice,
        sortOrder: idx,
      }));

      const patchRes = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItems, discount: edit.discount }),
      });
      if (!patchRes.ok) {
        const data = await patchRes.json();
        throw new Error(data.error || "Failed to update invoice");
      }

      // 3. Save completion + mark project completed
      const completionData = {
        ...form,
        internalCompleted: true,
        clientAcknowledged: true,
      };
      await fetch(`/api/projects/${projectId}/completion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(completionData),
      });

      toast.success("Invoice generated and project completed");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate invoice");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveCompletion(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/completion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      toast.success("Completion status saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const alreadyCompleted = ["COMPLETED", "INVOICED", "PAID", "CLOSED"].includes(projectStatus);

  return (
    <form onSubmit={handleSaveCompletion} className="space-y-6">
      {/* Estimate Line Items Review — only if there are pending estimates without invoices */}
      {pendingEstimates.length > 0 && !alreadyCompleted && (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-lg">Confirm Deliverables & Generate Invoice</h3>
            <p className="text-sm text-gray-500 mt-1">
              Review the line items from the approved estimate. Adjust quantities to match
              what was actually delivered, then generate the final invoice.
            </p>
          </div>

          {pendingEstimates.map((est) => {
            const edit = estimateEdits[est.id];
            const totals = estimateTotals[est.id];
            if (!edit || !totals) return null;

            const sym = est.currency === "CNY" ? "¥" : "$";

            return (
              <Card key={est.id} className="border-blue-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {est.title}
                      </CardTitle>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {est.estimateNumber}
                        {est.label ? ` — ${est.label}` : ""}
                        {" · "}{est.currency}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[45%]">Description</TableHead>
                        <TableHead className="w-[12%]">Unit</TableHead>
                        <TableHead className="text-right w-[13%]">Qty</TableHead>
                        <TableHead className="text-right w-[15%]">Unit Price</TableHead>
                        <TableHead className="text-right w-[15%]">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {edit.items.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm">{item.description}</TableCell>
                          <TableCell className="text-sm text-gray-500">{item.unit}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              value={item.quantity}
                              onChange={(e) =>
                                updateLineItem(est.id, idx, parseFloat(e.target.value) || 0)
                              }
                              className="w-20 ml-auto text-right h-8"
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

                  <Separator />

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
                          value={edit.discount}
                          onChange={(e) =>
                            updateDiscount(est.id, parseFloat(e.target.value) || 0)
                          }
                          className="w-24 text-right h-8"
                        />
                      </div>
                    </div>
                    {est.taxRate > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Tax ({est.taxRate}%)</span>
                        <span className="font-medium">{sym}{fmt(totals.tax)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total</span>
                      <span>{sym}{fmt(totals.total)}</span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      onClick={() => handleGenerateInvoice(est.id)}
                      disabled={generating || saving}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {generating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4 mr-2" />
                      )}
                      Generate Final Invoice
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Already completed — show status */}
      {pendingEstimates.length === 0 && hasInvoices && (
        <Card className="border-green-200 bg-green-50/30">
          <CardContent className="py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="font-medium text-green-800">
              {alreadyCompleted
                ? "Project completed. Invoices have been generated."
                : "All approved estimates have been invoiced."}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              View invoices in the Invoice tab.
            </p>
          </CardContent>
        </Card>
      )}

      {pendingEstimates.length === 0 && !hasInvoices && approvedEstimates.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No approved estimates yet. Approve an estimate first to generate an invoice during completion.
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Internal Sign-off */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Internal Sign-off</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              id="internalCompleted"
              checked={form.internalCompleted}
              onCheckedChange={(v) => setForm((prev) => ({ ...prev, internalCompleted: !!v }))}
            />
            <Label htmlFor="internalCompleted" className="font-medium cursor-pointer">
              Internal work completed
            </Label>
          </div>
          {initialData?.internalCompletedAt && (
            <p className="text-sm text-gray-500">
              Completed at: {new Date(initialData.internalCompletedAt).toLocaleString()}
              {initialData.internalCompletedBy && ` by ${initialData.internalCompletedBy.name}`}
            </p>
          )}
          <div className="space-y-2">
            <Label>Internal Notes</Label>
            <Textarea
              value={form.internalNotes}
              onChange={(e) => setForm((prev) => ({ ...prev, internalNotes: e.target.value }))}
              placeholder="Notes for internal team..."
              rows={3}
              className="resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Client Sign-off */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client Acknowledgement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              id="clientAcknowledged"
              checked={form.clientAcknowledged}
              onCheckedChange={(v) => setForm((prev) => ({ ...prev, clientAcknowledged: !!v }))}
            />
            <Label htmlFor="clientAcknowledged" className="font-medium cursor-pointer">
              Client has acknowledged completion
            </Label>
          </div>
          {initialData?.clientAcknowledgedAt && (
            <p className="text-sm text-gray-500">
              Acknowledged at: {new Date(initialData.clientAcknowledgedAt).toLocaleString()}
            </p>
          )}
          <div className="space-y-2">
            <Label>Acknowledged By (Client)</Label>
            <Input
              value={form.clientAcknowledgedBy}
              onChange={(e) => setForm((prev) => ({ ...prev, clientAcknowledgedBy: e.target.value }))}
              placeholder="Contact name"
            />
          </div>
          <div className="space-y-2">
            <Label>Client Notes</Label>
            <Textarea
              value={form.clientAcknowledgeNotes}
              onChange={(e) => setForm((prev) => ({ ...prev, clientAcknowledgeNotes: e.target.value }))}
              placeholder="Client feedback or notes..."
              rows={3}
              className="resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Deliverables */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deliverables Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.deliverablesNotes}
            onChange={(e) => setForm((prev) => ({ ...prev, deliverablesNotes: e.target.value }))}
            placeholder="Notes about deliverables provided to client..."
            rows={4}
            className="resize-none"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" variant="outline" disabled={saving || generating}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Progress
        </Button>
      </div>
    </form>
  );
}
