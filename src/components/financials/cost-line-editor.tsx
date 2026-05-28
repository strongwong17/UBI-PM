"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Loader2 } from "lucide-react";

interface CostLine {
  id: string;
  description: string;
  costType: string; // HOURS | FLAT
  hours: number | null;
  rate: number | null;
  amount: number | null;
}

interface Props {
  projectId: string;
  currencySymbol: string;
  initial: CostLine[];
}

function lineCost(l: CostLine): number {
  return l.costType === "HOURS" ? (l.hours ?? 0) * (l.rate ?? 0) : (l.amount ?? 0);
}

let tmp = 0;
const newId = () => `tmp-${tmp++}`;

export function CostLineEditor({ projectId, currencySymbol, initial }: Props) {
  const router = useRouter();
  const [lines, setLines] = useState<CostLine[]>(initial);
  const [saving, setSaving] = useState(false);

  function update(id: string, patch: Partial<CostLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [
      ...prev,
      { id: newId(), description: "", costType: "FLAT", hours: null, rate: null, amount: null },
    ]);
  }
  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  const total = lines.reduce((s, l) => s + lineCost(l), 0);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/costs`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineItems: lines.map((l) => ({
            description: l.description,
            costType: l.costType,
            hours: l.costType === "HOURS" ? l.hours : null,
            rate: l.costType === "HOURS" ? l.rate : null,
            amount: l.costType === "FLAT" ? l.amount : null,
          })),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(d.error || "Failed to save costs");
      }
      toast.success("Costs saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save costs");
    } finally {
      setSaving(false);
    }
  }

  const num = (v: number | null) => (v === null || Number.isNaN(v) ? "" : String(v));
  const parse = (s: string) => (s === "" ? null : Number(s));

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {lines.map((l) => (
          <div key={l.id} className="flex items-center gap-2">
            <Input
              className="flex-1"
              placeholder="Cost line (e.g. Recruiter labor)"
              value={l.description}
              onChange={(e) => update(l.id, { description: e.target.value })}
            />
            <div className="inline-flex rounded-md border border-hairline-strong overflow-hidden text-[11px] font-mono">
              <button
                type="button"
                className={l.costType === "HOURS" ? "px-2 py-1 bg-accent-rd text-white" : "px-2 py-1 text-ink-500"}
                onClick={() => update(l.id, { costType: "HOURS" })}
              >
                HRS
              </button>
              <button
                type="button"
                className={l.costType === "FLAT" ? "px-2 py-1 bg-accent-rd text-white" : "px-2 py-1 text-ink-500"}
                onClick={() => update(l.id, { costType: "FLAT" })}
              >
                FLAT
              </button>
            </div>
            {l.costType === "HOURS" ? (
              <>
                <Input
                  className="w-20"
                  type="number"
                  placeholder="hrs"
                  value={num(l.hours)}
                  onChange={(e) => update(l.id, { hours: parse(e.target.value) })}
                />
                <span className="text-ink-400 text-[12px]">×</span>
                <Input
                  className="w-24"
                  type="number"
                  placeholder="rate"
                  value={num(l.rate)}
                  onChange={(e) => update(l.id, { rate: parse(e.target.value) })}
                />
              </>
            ) : (
              <Input
                className="w-32"
                type="number"
                placeholder="amount"
                value={num(l.amount)}
                onChange={(e) => update(l.id, { amount: parse(e.target.value) })}
              />
            )}
            <div className="w-28 text-right font-mono text-[13px] rd-tabular">
              {currencySymbol}
              {lineCost(l).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <button type="button" className="text-accent-rd" onClick={() => removeLine(l.id)} aria-label="Remove">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-hairline">
        <Button variant="outline" size="sm" onClick={addLine}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add cost line
        </Button>
        <div className="flex items-center gap-4">
          <div className="font-mono text-[13px]">
            Total cost:{" "}
            <span className="font-bold text-accent-rd rd-tabular">
              {currencySymbol}
              {total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
          </Button>
        </div>
      </div>
    </div>
  );
}
