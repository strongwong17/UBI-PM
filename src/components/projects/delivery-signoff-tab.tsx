// src/components/projects/delivery-signoff-tab.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Copy, Save } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { currencySymbol } from "@/lib/currency";

export interface DeliveryLine {
  id: string;
  description: string;
  serviceModuleType: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  deliveredQuantity: number | null;
}

export interface DeliveryEstimate {
  id: string;
  estimateNumber: string;
  title: string;
  label: string | null;
  currency: string;
  lines: DeliveryLine[];
}

interface Props {
  projectId: string;
  projectStatus: string;
  estimates: DeliveryEstimate[];
  initialCompletion?: {
    internalCompleted: boolean;
    internalCompletedAt: string | null;
    internalCompletedBy: { name: string } | null;
    internalNotes: string | null;
    clientAcknowledged: boolean;
    clientAcknowledgedAt: string | null;
    clientAcknowledgedBy: string | null;
    clientAcknowledgeNotes: string | null;
    deliverablesNotes: string | null;
  } | null;
  billingSummary?: {
    estimated: number;
    invoiced: number;
    primaryCurrency: string;
  };
  hasInvoices: boolean;
}

function VarianceCell({ planned, delivered }: { planned: number; delivered: number | null }) {
  if (delivered == null) return <span className="text-gray-400">—</span>;
  const diff = delivered - planned;
  if (diff === 0) return <span className="text-gray-400">—</span>;
  const color = diff < 0 ? "text-red-600" : "text-emerald-700";
  return <span className={color}>{diff > 0 ? `+${diff}` : diff}</span>;
}

export function DeliverySignoffTab({ projectId, projectStatus, estimates, initialCompletion, billingSummary, hasInvoices }: Props) {
  const router = useRouter();
  const readOnly = projectStatus === "CLOSED";
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Record<string, number | null>>>(() => {
    const init: Record<string, Record<string, number | null>> = {};
    for (const est of estimates) {
      init[est.id] = {};
      for (const ln of est.lines) init[est.id][ln.id] = ln.deliveredQuantity;
    }
    return init;
  });

  const update = (estId: string, lineId: string, val: number | null) =>
    setEdits((prev) => ({ ...prev, [estId]: { ...prev[estId], [lineId]: val } }));

  const copyPlannedToDelivered = (est: DeliveryEstimate) => {
    setEdits((prev) => ({
      ...prev,
      [est.id]: Object.fromEntries(est.lines.map((l) => [l.id, l.quantity])),
    }));
  };

  const [signoff, setSignoff] = useState({
    internalCompleted: initialCompletion?.internalCompleted ?? false,
    internalNotes: initialCompletion?.internalNotes ?? "",
    clientAcknowledged: initialCompletion?.clientAcknowledged ?? false,
    clientAcknowledgedBy: initialCompletion?.clientAcknowledgedBy ?? "",
    clientAcknowledgeNotes: initialCompletion?.clientAcknowledgeNotes ?? "",
    deliverablesNotes: initialCompletion?.deliverablesNotes ?? "",
  });
  const [savingSignoff, setSavingSignoff] = useState(false);

  const saveSignoff = async () => {
    setSavingSignoff(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/completion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signoff),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      toast.success("Sign-off saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingSignoff(false);
    }
  };

  const saveEstimate = async (est: DeliveryEstimate) => {
    setSaving(est.id);
    try {
      const lines = est.lines.map((l) => ({
        estimateLineItemId: l.id,
        deliveredQuantity: edits[est.id]?.[l.id] ?? null,
      }));
      const res = await fetch(`/api/projects/${projectId}/delivery`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      toast.success("Delivered quantities saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  if (estimates.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          No approved estimates. Approve an estimate to record delivered quantities.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-lg">Confirm actuals</h3>
        <p className="text-sm text-gray-500 mt-1">
          Record what was actually delivered. Variance highlights any difference from plan.
        </p>
      </div>

      {estimates.map((est) => {
        const sym = est.currency === "CNY" ? "¥" : "$";
        return (
          <Card key={est.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base">{est.title}</CardTitle>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {est.estimateNumber}{est.label ? ` — ${est.label}` : ""} · {est.currency}
                  </p>
                </div>
                {!readOnly && (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => copyPlannedToDelivered(est)}>
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      Copy planned → delivered
                    </Button>
                    <Button type="button" size="sm" onClick={() => saveEstimate(est)} disabled={saving === est.id}>
                      {saving === est.id ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                      Save
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Line item</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead className="text-right">Planned</TableHead>
                    <TableHead className="text-right">Delivered</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {est.lines.map((ln) => {
                    const val = edits[est.id]?.[ln.id];
                    return (
                      <TableRow key={ln.id}>
                        <TableCell className="text-sm">{ln.description}</TableCell>
                        <TableCell className="text-xs text-gray-500">{ln.serviceModuleType ?? "—"}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{ln.quantity}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={val ?? ""}
                            disabled={readOnly}
                            placeholder="—"
                            onChange={(e) => {
                              if (e.target.value === "") {
                                update(est.id, ln.id, null);
                                return;
                              }
                              const n = parseFloat(e.target.value);
                              update(est.id, ln.id, Number.isFinite(n) ? n : null);
                            }}
                            className="w-20 ml-auto text-right h-8"
                          />
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <VarianceCell planned={ln.quantity} delivered={val ?? null} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      <Separator />

      {/* Section B — Sign-off */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sign-off</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Checkbox
                id="internalCompleted"
                checked={signoff.internalCompleted}
                disabled={readOnly}
                onCheckedChange={(v) => setSignoff((p) => ({ ...p, internalCompleted: !!v }))}
              />
              <Label htmlFor="internalCompleted" className="font-medium cursor-pointer">
                Internal work completed
              </Label>
            </div>
            {initialCompletion?.internalCompletedAt && (
              <p className="text-xs text-gray-500 ml-7">
                Completed {new Date(initialCompletion.internalCompletedAt).toLocaleDateString()}
                {initialCompletion.internalCompletedBy && ` by ${initialCompletion.internalCompletedBy.name}`}
              </p>
            )}
            <Textarea
              value={signoff.internalNotes}
              disabled={readOnly}
              onChange={(e) => setSignoff((p) => ({ ...p, internalNotes: e.target.value }))}
              placeholder="Internal notes…"
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Checkbox
                id="clientAck"
                checked={signoff.clientAcknowledged}
                disabled={readOnly}
                onCheckedChange={(v) => setSignoff((p) => ({ ...p, clientAcknowledged: !!v }))}
              />
              <Label htmlFor="clientAck" className="font-medium cursor-pointer">
                Client acknowledged
              </Label>
            </div>
            {initialCompletion?.clientAcknowledgedAt && (
              <p className="text-xs text-gray-500 ml-7">
                Acknowledged {new Date(initialCompletion.clientAcknowledgedAt).toLocaleDateString()}
              </p>
            )}
            <Input
              value={signoff.clientAcknowledgedBy}
              disabled={readOnly}
              onChange={(e) => setSignoff((p) => ({ ...p, clientAcknowledgedBy: e.target.value }))}
              placeholder="Acknowledged by (client name)"
            />
            <Textarea
              value={signoff.clientAcknowledgeNotes}
              disabled={readOnly}
              onChange={(e) => setSignoff((p) => ({ ...p, clientAcknowledgeNotes: e.target.value }))}
              placeholder="Client feedback or notes…"
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label>Deliverables notes</Label>
            <Textarea
              value={signoff.deliverablesNotes}
              disabled={readOnly}
              onChange={(e) => setSignoff((p) => ({ ...p, deliverablesNotes: e.target.value }))}
              placeholder="What was delivered to the client…"
              rows={3}
              className="resize-none"
            />
          </div>

          {!readOnly && (
            <div className="flex justify-end">
              <Button type="button" onClick={saveSignoff} disabled={savingSignoff}>
                {savingSignoff && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save sign-off
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section C — What's next */}
      {billingSummary && (() => {
        const sym = currencySymbol(billingSummary.primaryCurrency);
        return (
          <Card className="border-green-200 bg-green-50/40">
            <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="text-sm">
                {hasInvoices ? (
                  <>
                    Estimated <strong>{sym}{billingSummary.estimated.toLocaleString()}</strong>
                    {" / "}
                    Invoiced <strong>{sym}{billingSummary.invoiced.toLocaleString()}</strong>
                    {billingSummary.invoiced < billingSummary.estimated && (
                      <> · <span className="text-amber-700">Remaining {sym}{(billingSummary.estimated - billingSummary.invoiced).toLocaleString()}</span></>
                    )}
                  </>
                ) : (
                  <>✓ Generate the final invoice in the Invoices tab.</>
                )}
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/projects/${projectId}?tab=invoice`}>Go to Invoices</Link>
              </Button>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
