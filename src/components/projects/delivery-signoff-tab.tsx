// src/components/projects/delivery-signoff-tab.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { phaseTokens } from "@/lib/redesign-tokens";
import { showUnderDevToast } from "@/components/redesign/under-dev-toast";
import { currencySymbol } from "@/lib/currency";
import { Loader2 } from "lucide-react";

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

/* ───────────────────────────── helpers ───────────────────────────── */

// Map serviceModuleType → execution phase key (matches phaseTokens groups).
function moduleToPhase(moduleType: string | null): "RECRUITMENT" | "FIELDWORK" | "ANALYSIS" | "REPORTING" | "OTHER" {
  switch (moduleType) {
    case "RECRUITMENT":
      return "RECRUITMENT";
    case "MODERATION":
    case "SIMULTANEOUS_TRANSLATION":
    case "VENUE":
    case "INCENTIVES":
    case "LOGISTICS":
      return "FIELDWORK";
    case "REPORTING":
      return "REPORTING";
    case "PROJECT_MANAGEMENT":
      return "ANALYSIS";
    default:
      return "OTHER";
  }
}

const PHASE_LABEL: Record<string, string> = {
  RECRUITMENT: "Recruitment",
  FIELDWORK: "Fieldwork",
  ANALYSIS: "Analysis",
  REPORTING: "Reporting",
  OTHER: "Other",
};

// Order phases in the canonical execution sequence.
const PHASE_ORDER = ["RECRUITMENT", "FIELDWORK", "ANALYSIS", "REPORTING", "OTHER"];

function fmtMoney(currency: string, amount: number): string {
  const sym = currencySymbol(currency);
  return `${sym}${Math.round(amount).toLocaleString("en-US")}`;
}

function fmtMoneyExact(currency: string, amount: number): string {
  const sym = currencySymbol(currency);
  return `${sym}${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function fmtTime(d: Date): string {
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}
function fmtDateMono(d: Date): string {
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/* ───────────────────────── variance chip ───────────────────────── */

function VarianceChip({
  planned,
  delivered,
  unitPrice,
  currency,
}: {
  planned: number;
  delivered: number | null;
  unitPrice: number;
  currency: string;
}) {
  if (delivered == null) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-1 rounded-full font-mono text-[11px] font-bold tracking-[0.02em]"
        style={{
          background: "transparent",
          color: "var(--color-ink-400)",
          border: "1px dashed var(--color-ink-300)",
        }}
      >
        {"// pending"}
      </span>
    );
  }
  const deltaQty = delivered - planned;
  const deltaMoney = deltaQty * unitPrice;
  const pct = planned > 0 ? (deltaQty / planned) * 100 : 0;
  if (Math.abs(deltaMoney) < 0.005) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-1 rounded-full font-mono text-[11px] font-bold tracking-[0.02em]"
        style={{ background: "var(--color-canvas-cool)", color: "var(--color-ink-500)" }}
      >
        on plan
      </span>
    );
  }
  const isUnder = deltaMoney < 0;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full font-mono text-[11px] font-bold tracking-[0.02em]"
      style={{
        background: isUnder ? "rgba(5, 150, 105, 0.10)" : "rgba(220, 38, 38, 0.10)",
        color: isUnder ? "var(--color-var-under)" : "var(--color-var-over)",
      }}
    >
      {isUnder ? "-" : "+"}
      {fmtMoney(currency, Math.abs(deltaMoney))} / {isUnder ? "" : "+"}
      {pct.toFixed(1)}%
    </span>
  );
}

/* ───────────────────────── main component ───────────────────────── */

export function DeliverySignoffTab({
  projectId,
  projectStatus,
  estimates,
  initialCompletion,
}: Props) {
  const router = useRouter();
  const readOnly = projectStatus === "CLOSED";

  // Multi-estimate selection
  const [activeEstimateId, setActiveEstimateId] = useState<string>(
    estimates[0]?.id ?? ""
  );
  const activeEstimate = estimates.find((e) => e.id === activeEstimateId) ?? estimates[0];

  // Edits keyed per-estimate so switching doesn't lose state.
  const [edits, setEdits] = useState<Record<string, Record<string, number | null>>>(() => {
    const init: Record<string, Record<string, number | null>> = {};
    for (const est of estimates) {
      init[est.id] = {};
      for (const ln of est.lines) init[est.id][ln.id] = ln.deliveredQuantity;
    }
    return init;
  });

  // Track which lines the user has "confirmed" in this session
  // (any non-null edit counts as confirmed for visual purposes).
  const update = (estId: string, lineId: string, val: number | null) =>
    setEdits((prev) => ({ ...prev, [estId]: { ...prev[estId], [lineId]: val } }));

  const markAllAsPlanned = () => {
    if (!activeEstimate) return;
    setEdits((prev) => ({
      ...prev,
      [activeEstimate.id]: Object.fromEntries(
        activeEstimate.lines.map((l) => [l.id, l.quantity])
      ),
    }));
  };

  // Sign-off state
  const [signoff, setSignoff] = useState({
    internalCompleted: initialCompletion?.internalCompleted ?? false,
    internalNotes: initialCompletion?.internalNotes ?? "",
    clientAcknowledged: initialCompletion?.clientAcknowledged ?? false,
    clientAcknowledgedBy: initialCompletion?.clientAcknowledgedBy ?? "",
    clientAcknowledgeNotes: initialCompletion?.clientAcknowledgeNotes ?? "",
    deliverablesNotes: initialCompletion?.deliverablesNotes ?? "",
  });
  const initialSignoffJson = useMemo(
    () =>
      JSON.stringify({
        internalCompleted: initialCompletion?.internalCompleted ?? false,
        internalNotes: initialCompletion?.internalNotes ?? "",
        clientAcknowledged: initialCompletion?.clientAcknowledged ?? false,
        clientAcknowledgedBy: initialCompletion?.clientAcknowledgedBy ?? "",
        clientAcknowledgeNotes: initialCompletion?.clientAcknowledgeNotes ?? "",
        deliverablesNotes: initialCompletion?.deliverablesNotes ?? "",
      }),
    [initialCompletion]
  );
  const signoffChanged = JSON.stringify(signoff) !== initialSignoffJson;

  const [savingDraft, setSavingDraft] = useState(false);
  const [confirming, setConfirming] = useState(false);

  /* ─────────────── data flow ─────────────── */

  async function persistDelivery(): Promise<void> {
    if (!activeEstimate) return;
    const lines = activeEstimate.lines.map((l) => ({
      estimateLineItemId: l.id,
      deliveredQuantity: edits[activeEstimate.id]?.[l.id] ?? null,
    }));
    const r = await fetch(`/api/projects/${projectId}/delivery`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error ?? "Failed to save delivered quantities");
    }
  }

  async function persistSignoff(): Promise<void> {
    const r = await fetch(`/api/projects/${projectId}/completion`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signoff),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error ?? "Failed to save sign-off");
    }
  }

  const handleSaveDraft = async () => {
    if (readOnly || !activeEstimate) return;
    setSavingDraft(true);
    try {
      await persistDelivery();
      if (signoffChanged) await persistSignoff();
      toast.success("Draft saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleConfirm = async () => {
    if (readOnly || !activeEstimate) return;
    setConfirming(true);
    try {
      await persistDelivery();
      if (signoffChanged) await persistSignoff();
      const slice = activeEstimate.lines
        .filter((l) => (edits[activeEstimate.id]?.[l.id] ?? 0) > 0)
        .map((l) => ({
          estimateLineItemId: l.id,
          quantity: edits[activeEstimate.id]![l.id]!,
        }));
      const r3 = await fetch(`/api/projects/${projectId}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateId: activeEstimate.id, mode: "SLICE", lines: slice }),
      });
      if (!r3.ok) {
        const j = await r3.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to generate invoice");
      }
      const inv = await r3.json();
      toast.success("Draft invoice generated");
      router.push(`/invoices/${inv.id}/send`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to confirm");
    } finally {
      setConfirming(false);
    }
  };

  /* ─────────────── derived data ─────────────── */

  const currency = activeEstimate?.currency ?? "USD";
  const lineEdits = useMemo<Record<string, number | null>>(
    () => (activeEstimate ? edits[activeEstimate.id] ?? {} : {}),
    [activeEstimate, edits]
  );

  // Group lines by phase
  const phaseGroups = useMemo(() => {
    if (!activeEstimate) return [] as { phase: string; lines: DeliveryLine[] }[];
    const groups = new Map<string, DeliveryLine[]>();
    for (const ln of activeEstimate.lines) {
      const phase = moduleToPhase(ln.serviceModuleType);
      if (!groups.has(phase)) groups.set(phase, []);
      groups.get(phase)!.push(ln);
    }
    // Order by canonical sequence
    return PHASE_ORDER.filter((p) => groups.has(p)).map((p) => ({
      phase: p,
      lines: groups.get(p)!,
    }));
  }, [activeEstimate]);

  // Totals across the active estimate
  const totals = useMemo(() => {
    let planned = 0;
    let delivered = 0;
    let confirmed = 0;
    let pending = 0;
    let pendingMoney = 0;
    if (!activeEstimate) {
      return { planned, delivered, confirmed, pending, pendingMoney, variance: 0, total: 0 };
    }
    for (const ln of activeEstimate.lines) {
      const p = ln.quantity * ln.unitPrice;
      planned += p;
      const v = lineEdits[ln.id];
      if (v == null) {
        pending++;
        pendingMoney += p;
      } else {
        confirmed++;
        delivered += v * ln.unitPrice;
      }
    }
    const variance = delivered - (planned - pendingMoney); // among confirmed lines only
    const total = activeEstimate.lines.length;
    return { planned, delivered, confirmed, pending, pendingMoney, variance, total };
  }, [activeEstimate, lineEdits]);

  if (estimates.length === 0 || !activeEstimate) {
    return (
      <div
        className="bg-card-rd border border-hairline rounded-2xl p-8 text-center"
        style={{ background: "var(--color-card-rd)" }}
      >
        <p className="text-sm text-ink-500">
          No approved estimates. Approve an estimate to record delivered quantities.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Multi-estimate selector — only when more than one */}
      {estimates.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
            {"// ESTIMATE"}
          </span>
          <select
            value={activeEstimate.id}
            onChange={(e) => setActiveEstimateId(e.target.value)}
            className="px-3 py-1.5 rounded-lg border bg-card-rd text-sm font-medium text-ink-900"
            style={{ borderColor: "var(--color-hairline-strong)" }}
          >
            {estimates.map((est) => (
              <option key={est.id} value={est.id}>
                {est.estimateNumber}
                {est.label ? ` — ${est.label}` : ""} · {est.currency}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Action header */}
      <div
        className="flex items-start justify-between gap-4 flex-wrap pb-[18px]"
        style={{ borderBottom: "1px solid var(--color-hairline)" }}
      >
        <div>
          <h2 className="text-[20px] font-bold tracking-[-0.02em] m-0 mb-1 text-ink-900">
            Confirm actuals
          </h2>
          <p className="text-[13px] text-ink-500 m-0 max-w-[520px]">
            For each line, confirm what was actually delivered. Variance auto-calculates against the
            planned quantity. Once confirmed, you&apos;ll move to invoice generation.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => showUnderDevToast("Pull from deliverables")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd"
            style={{
              background: "var(--color-canvas-cool)",
              border: "1px solid var(--color-hairline-strong)",
            }}
          >
            <span>↓</span> Pull from deliverables
          </button>
          <button
            type="button"
            onClick={markAllAsPlanned}
            disabled={readOnly}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd disabled:opacity-50"
            style={{
              background: "var(--color-canvas-cool)",
              border: "1px solid var(--color-hairline-strong)",
            }}
          >
            <span>✓</span> Mark all as planned
          </button>
        </div>
      </div>

      {/* Phase blocks */}
      {phaseGroups.map(({ phase, lines }, phaseIdx) => {
        const tokens = phaseTokens(phase);
        // Phase totals
        let phasePlanned = 0;
        let phaseDelivered = 0;
        let phaseDeliveredHasAll = true;
        let phaseDeliveredHasAny = false;
        for (const ln of lines) {
          phasePlanned += ln.quantity * ln.unitPrice;
          const v = lineEdits[ln.id];
          if (v == null) {
            phaseDeliveredHasAll = false;
          } else {
            phaseDeliveredHasAny = true;
            phaseDelivered += v * ln.unitPrice;
          }
        }
        const phaseVariance = phaseDeliveredHasAll
          ? phaseDelivered - phasePlanned
          : null;

        return (
          <div
            key={phase}
            className="bg-card-rd rounded-[14px] overflow-hidden"
            style={{
              border: "1px solid var(--color-hairline)",
              boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
              background: "var(--color-card-rd)",
            }}
          >
            {/* Phase head */}
            <div
              className="px-5 py-3.5 flex items-center gap-3"
              style={{
                borderBottom: "1px solid var(--color-hairline)",
                background: "linear-gradient(180deg, #FCFAF6 0%, #FFFFFF 100%)",
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: tokens.dot }}
              />
              <h3
                className="font-mono text-[11px] font-bold tracking-[0.06em] uppercase m-0"
                style={{ color: tokens.fg }}
              >
                Phase {phaseIdx + 1} · {PHASE_LABEL[phase] ?? phase}
              </h3>
              <span
                className="ml-auto font-mono text-[11px] tracking-[0.02em]"
                style={{ color: "var(--color-ink-500)" }}
              >
                {lines.length} {lines.length === 1 ? "line" : "lines"} · planned{" "}
                <strong className="text-ink-900 font-bold">
                  {fmtMoney(currency, phasePlanned)}
                </strong>
              </span>
            </div>

            {/* Column header */}
            <div
              className="grid gap-3 px-5 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.06em]"
              style={{
                gridTemplateColumns: "1fr 130px 200px 130px 24px",
                background: "#FAFAF6",
                borderBottom: "1px solid var(--color-hairline)",
                color: "var(--color-ink-400)",
              }}
            >
              <span>Line item</span>
              <span className="text-right">Planned</span>
              <span className="text-right">Delivered</span>
              <span className="text-right">Variance</span>
              <span></span>
            </div>

            {/* Lines */}
            {lines.map((ln) => {
              const planned = ln.quantity * ln.unitPrice;
              const v = lineEdits[ln.id];
              const isConfirmed = v != null;
              const deliveredMoney = (v ?? 0) * ln.unitPrice;
              return (
                <div
                  key={ln.id}
                  className="grid gap-3 items-center px-5 py-3.5 transition-colors hover:bg-[#FCFAF6]"
                  style={{
                    gridTemplateColumns: "1fr 130px 200px 130px 24px",
                    borderBottom: "1px solid var(--color-hairline)",
                  }}
                >
                  {/* description */}
                  <div>
                    <div className="text-[13px] font-medium text-ink-900 leading-[1.3] tracking-[-0.005em]">
                      {ln.description}
                      {isConfirmed && (
                        <span
                          className="inline-flex items-center gap-1 ml-2 font-mono text-[9px] font-bold uppercase tracking-[0.06em]"
                          style={{ color: "var(--color-s-delivered-fg)" }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: "var(--color-s-delivered)" }}
                          />
                          Confirmed
                        </span>
                      )}
                    </div>
                    <div
                      className="font-mono text-[10px] mt-0.5 tracking-[0.02em]"
                      style={{ color: "var(--color-ink-300)" }}
                    >
                      {"// EST-line · "}{ln.quantity} {ln.unit} × {fmtMoneyExact(currency, ln.unitPrice)} = {fmtMoney(currency, planned)}
                    </div>
                  </div>

                  {/* planned */}
                  <div className="text-right text-[13px] text-ink-700 rd-tabular">
                    <div className="text-[11px] mb-0.5" style={{ color: "var(--color-ink-500)" }}>
                      {ln.quantity} {ln.unit !== "ea" ? ln.unit : ""} ×{" "}
                      {fmtMoneyExact(currency, ln.unitPrice)}
                    </div>
                    <div>{fmtMoney(currency, planned)}</div>
                  </div>

                  {/* delivered input */}
                  <div>
                    <div
                      className="flex items-center rounded-lg overflow-hidden transition-colors"
                      style={{
                        background: isConfirmed ? "var(--color-s-delivered-bg)" : "var(--color-card-rd)",
                        border: isConfirmed
                          ? "1.5px solid var(--color-s-delivered)"
                          : "1.5px solid var(--color-hairline)",
                      }}
                    >
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={v ?? ""}
                        disabled={readOnly}
                        placeholder="0"
                        onChange={(e) => {
                          if (e.target.value === "") {
                            update(activeEstimate.id, ln.id, null);
                            return;
                          }
                          const n = parseFloat(e.target.value);
                          update(activeEstimate.id, ln.id, Number.isFinite(n) ? n : null);
                        }}
                        className="flex-1 px-2.5 py-1.5 bg-transparent border-0 text-[13px] text-right text-ink-900 rd-tabular focus:outline-none"
                        style={{ width: "100%" }}
                      />
                      <span
                        className="px-2.5 font-mono text-[10px] tracking-[0.04em]"
                        style={{
                          color: isConfirmed
                            ? "var(--color-s-delivered-fg)"
                            : "var(--color-ink-400)",
                        }}
                      >
                        × {fmtMoneyExact(currency, ln.unitPrice)}
                        {isConfirmed && ` = ${fmtMoney(currency, deliveredMoney)}`}
                      </span>
                    </div>
                  </div>

                  {/* variance */}
                  <div className="flex items-center justify-end">
                    <VarianceChip
                      planned={ln.quantity}
                      delivered={v ?? null}
                      unitPrice={ln.unitPrice}
                      currency={currency}
                    />
                  </div>

                  <span
                    className="text-right cursor-pointer"
                    style={{ color: "var(--color-ink-300)" }}
                  >
                    ⋯
                  </span>
                </div>
              );
            })}

            {/* Phase footer */}
            <div
              className="grid gap-3 px-5 py-3"
              style={{
                gridTemplateColumns: "1fr 130px 200px 130px 24px",
                background: "#FAFAF6",
                borderTop: "1px dashed var(--color-hairline)",
              }}
            >
              <span></span>
              <span
                className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-right"
                style={{ color: "var(--color-ink-500)" }}
              >
                {phaseDeliveredHasAll
                  ? "Phase total"
                  : phaseDeliveredHasAny
                  ? "Phase total · partial"
                  : "Phase total · pending"}
              </span>
              <span
                className="font-mono text-[12px] font-bold rd-tabular text-right"
                style={{
                  color: phaseDeliveredHasAny ? "var(--color-ink-900)" : "var(--color-ink-300)",
                }}
              >
                {phaseDeliveredHasAny ? fmtMoney(currency, phaseDelivered) : "—"}
              </span>
              <span
                className="font-mono text-[12px] font-bold rd-tabular text-right"
                style={{
                  color:
                    phaseVariance == null
                      ? "var(--color-ink-300)"
                      : phaseVariance < 0
                      ? "var(--color-var-under)"
                      : phaseVariance > 0
                      ? "var(--color-var-over)"
                      : "var(--color-ink-900)",
                }}
              >
                {phaseVariance == null
                  ? "—"
                  : `${phaseVariance < 0 ? "-" : phaseVariance > 0 ? "+" : ""}${fmtMoney(
                      currency,
                      Math.abs(phaseVariance)
                    )}`}
              </span>
              <span></span>
            </div>
          </div>
        );
      })}

      {/* Totals card */}
      <div
        className="rounded-[14px] p-5 mt-6 mb-5"
        style={{
          background: "var(--color-card-rd)",
          border: "2px solid var(--color-ink-900)",
          boxShadow: "0 6px 24px -6px rgba(15, 23, 41, 0.10), 0 2px 6px -2px rgba(15, 23, 41, 0.06)",
        }}
      >
        <div className="grid grid-cols-3 gap-6 items-end">
          <div className="pr-6" style={{ borderRight: "1px dashed var(--color-hairline)" }}>
            <p className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase m-0 mb-2 text-ink-500">
              {"// PLANNED"}
            </p>
            <div className="text-[28px] font-extrabold tracking-[-0.025em] leading-none rd-tabular text-ink-900 mb-1">
              {fmtMoney(currency, totals.planned)}
            </div>
            <div className="font-mono text-[11px] tracking-[0.02em] text-ink-400">
              {totals.total} line {totals.total === 1 ? "item" : "items"}
            </div>
          </div>
          <div className="pr-6" style={{ borderRight: "1px dashed var(--color-hairline)" }}>
            <p className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase m-0 mb-2 text-ink-500">
              {"// DELIVERED"}
              {totals.pending > 0 && totals.confirmed > 0 ? " · PARTIAL" : ""}
              {totals.pending === 0 ? " · COMPLETE" : ""}
            </p>
            <div className="text-[28px] font-extrabold tracking-[-0.025em] leading-none rd-tabular text-ink-900 mb-1">
              {fmtMoney(currency, totals.delivered)}
            </div>
            <div className="font-mono text-[11px] tracking-[0.02em] text-ink-400">
              {totals.confirmed} of {totals.total} confirmed
              {totals.pending > 0 && ` · ${fmtMoney(currency, totals.pendingMoney)} pending`}
            </div>
          </div>
          <div>
            <p className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase m-0 mb-2 text-ink-500">
              {"// VARIANCE"}
            </p>
            <div
              className="text-[28px] font-extrabold tracking-[-0.025em] leading-none rd-tabular mb-1"
              style={{
                color:
                  totals.variance < 0
                    ? "var(--color-var-under)"
                    : totals.variance > 0
                    ? "var(--color-var-over)"
                    : "var(--color-ink-900)",
              }}
            >
              {totals.variance < 0 ? "-" : totals.variance > 0 ? "+" : ""}
              {fmtMoney(currency, Math.abs(totals.variance))}
            </div>
            <div className="font-mono text-[11px] tracking-[0.02em] text-ink-400">
              {totals.pending > 0 ? "running · " : ""}
              {totals.planned > 0
                ? `${totals.variance >= 0 ? "+" : ""}${(
                    (totals.variance / totals.planned) *
                    100
                  ).toFixed(1)}% of ${fmtMoney(currency, totals.planned)}`
                : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Notes & sign-off */}
      <div
        className="rounded-[14px] p-5 mb-5"
        style={{
          background: "var(--color-card-rd)",
          border: "1px solid var(--color-hairline)",
          boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
        }}
      >
        <p className="font-mono text-[11px] font-bold tracking-[0.06em] uppercase m-0 mb-3.5 text-ink-500">
          {"// NOTES & SIGN-OFF"}
        </p>
        <textarea
          value={signoff.deliverablesNotes}
          disabled={readOnly}
          onChange={(e) =>
            setSignoff((p) => ({ ...p, deliverablesNotes: e.target.value }))
          }
          placeholder="Notes about variance, delivered scope, anything the client should know about this reconciliation…"
          className="w-full px-3 py-2.5 rounded-lg text-[13px] text-ink-900 resize-y mb-4"
          style={{
            background: "var(--color-canvas-cool)",
            border: "1px solid var(--color-hairline)",
            minHeight: 60,
          }}
        />

        {/* Internal sign-off */}
        <div
          className="flex items-center gap-3 py-2.5"
          style={{ borderTop: "1px dashed var(--color-hairline)" }}
        >
          <button
            type="button"
            disabled={readOnly}
            onClick={() =>
              setSignoff((p) => ({ ...p, internalCompleted: !p.internalCompleted }))
            }
            aria-pressed={signoff.internalCompleted}
            className="w-[18px] h-[18px] rounded-md flex-shrink-0 cursor-pointer relative"
            style={{
              background: signoff.internalCompleted
                ? "var(--color-ink-900)"
                : "var(--color-card-rd)",
              border: signoff.internalCompleted
                ? "1.5px solid var(--color-ink-900)"
                : "1.5px solid var(--color-ink-300)",
            }}
          >
            {signoff.internalCompleted && (
              <span className="absolute -top-[2px] left-[2px] text-white text-[13px] font-bold leading-none">
                ✓
              </span>
            )}
          </button>
          <span className="text-[13px] font-medium text-ink-900">Internal sign-off</span>
          {signoff.internalCompleted && (
            <span
              className="font-mono text-[11px] ml-1 tracking-[0.02em]"
              style={{ color: "var(--color-ink-400)" }}
            >
              {"// "}
              {initialCompletion?.internalCompletedBy?.name?.split(" ")[0]?.toUpperCase() ?? "YOU"}
              {" · "}
              {initialCompletion?.internalCompletedAt
                ? `${fmtDateMono(new Date(initialCompletion.internalCompletedAt))} · ${fmtTime(
                    new Date(initialCompletion.internalCompletedAt)
                  )}`
                : `${fmtDateMono(new Date())} · ${fmtTime(new Date())}`}
            </span>
          )}
          <textarea
            value={signoff.internalNotes}
            disabled={readOnly}
            onChange={(e) => setSignoff((p) => ({ ...p, internalNotes: e.target.value }))}
            placeholder="Internal notes…"
            rows={1}
            className="ml-auto px-2.5 py-1.5 rounded-md text-[12px] text-ink-900 resize-none"
            style={{
              background: "var(--color-card-rd)",
              border: "1px solid var(--color-hairline)",
              maxWidth: 240,
              minHeight: 32,
            }}
          />
        </div>

        {/* Client acknowledgement */}
        <div
          className="flex items-center gap-3 py-2.5"
          style={{ borderTop: "1px dashed var(--color-hairline)" }}
        >
          <button
            type="button"
            disabled={readOnly}
            onClick={() =>
              setSignoff((p) => ({ ...p, clientAcknowledged: !p.clientAcknowledged }))
            }
            aria-pressed={signoff.clientAcknowledged}
            className="w-[18px] h-[18px] rounded-md flex-shrink-0 cursor-pointer relative"
            style={{
              background: signoff.clientAcknowledged
                ? "var(--color-ink-900)"
                : "var(--color-card-rd)",
              border: signoff.clientAcknowledged
                ? "1.5px solid var(--color-ink-900)"
                : "1.5px solid var(--color-ink-300)",
            }}
          >
            {signoff.clientAcknowledged && (
              <span className="absolute -top-[2px] left-[2px] text-white text-[13px] font-bold leading-none">
                ✓
              </span>
            )}
          </button>
          <span className="text-[13px] font-medium text-ink-900">Client acknowledgement</span>
          <input
            type="text"
            value={signoff.clientAcknowledgedBy}
            disabled={readOnly}
            onChange={(e) =>
              setSignoff((p) => ({ ...p, clientAcknowledgedBy: e.target.value }))
            }
            placeholder="Client contact name"
            className="ml-auto px-2.5 py-1.5 rounded-md text-[12px] text-ink-900"
            style={{
              background: "var(--color-card-rd)",
              border: "1px solid var(--color-hairline)",
              maxWidth: 200,
            }}
          />
        </div>
      </div>

      {/* Action footer */}
      <div
        className="flex items-center justify-between p-4 rounded-[14px] mt-5 sticky"
        style={{
          background: "var(--color-card-rd)",
          border: "1px solid var(--color-hairline)",
          boxShadow:
            "0 6px 24px -6px rgba(15, 23, 41, 0.10), 0 2px 6px -2px rgba(15, 23, 41, 0.06)",
          bottom: 16,
          zIndex: 5,
        }}
      >
        <div className="flex items-center gap-3">
          <div className="text-[12px] text-ink-500">
            <strong className="text-ink-900 font-bold rd-tabular">
              {totals.confirmed} of {totals.total}
            </strong>{" "}
            lines confirmed
            {totals.confirmed > 0 && (
              <>
                {" · "}
                <strong
                  className="font-bold rd-tabular"
                  style={{
                    color:
                      totals.variance < 0
                        ? "var(--color-var-under)"
                        : totals.variance > 0
                        ? "var(--color-var-over)"
                        : "var(--color-ink-900)",
                  }}
                >
                  {totals.variance < 0 ? "-" : totals.variance > 0 ? "+" : ""}
                  {fmtMoney(currency, Math.abs(totals.variance))}
                </strong>{" "}
                variance
              </>
            )}
            {totals.pending > 0 && (
              <>
                {" · "}
                <strong className="text-ink-900 font-bold rd-tabular">
                  {fmtMoney(currency, totals.pendingMoney)}
                </strong>{" "}
                still pending
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={savingDraft || confirming || readOnly}
            className="px-3 py-2 rounded-lg text-[13px] font-medium text-ink-700 hover:bg-[rgba(15,23,41,0.04)] disabled:opacity-50"
          >
            {savingDraft ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving…
              </span>
            ) : (
              "Save draft"
            )}
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={savingDraft || confirming || readOnly}
            className="px-3.5 py-2 rounded-lg text-[13px] font-medium text-ink-900 disabled:opacity-50"
            style={{
              background: "var(--color-card-rd)",
              border: "1px solid var(--color-hairline)",
            }}
          >
            Save &amp; continue later
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={savingDraft || confirming || readOnly || totals.confirmed === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white tracking-[-0.005em] disabled:opacity-50"
            style={{
              background: "var(--color-s-delivered)",
              boxShadow: "0 4px 12px -2px rgba(5, 150, 105, 0.32)",
            }}
          >
            {confirming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>✓ Confirm &amp; generate draft invoice</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
