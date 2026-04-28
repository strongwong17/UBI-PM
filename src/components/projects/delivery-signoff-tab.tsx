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
}

function VarianceCell({ planned, delivered }: { planned: number; delivered: number | null }) {
  if (delivered == null) return <span className="text-gray-400">—</span>;
  const diff = delivered - planned;
  if (diff === 0) return <span className="text-gray-400">—</span>;
  const color = diff < 0 ? "text-red-600" : "text-emerald-700";
  return <span className={color}>{diff > 0 ? `+${diff}` : diff}</span>;
}

export function DeliverySignoffTab({ projectId, projectStatus, estimates }: Props) {
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
    </div>
  );
}
