"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Loader2, ChevronDown, ChevronUp, Layers, Plus } from "lucide-react";
import { TemplatePicker } from "./template-picker";
import { currencySymbol } from "@/lib/currency";

// ── Types ──────────────────────────────────────────────────────────────────

interface LineItem {
  _key: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  notes: string;
  // percentage mode
  percentageBasis: "" | "SUBTOTAL" | "PHASE" | "LINE_ITEM";
  percentageRate: number;   // e.g. 15 for 15%
  basisPhaseName: string;   // phase name when percentageBasis = "PHASE"
  basisLineItemKey: string; // line item _key when percentageBasis = "LINE_ITEM"
  basisLineItemDesc: string; // line item description (for save/display)
}

interface Phase {
  _key: string;
  name: string;
  description: string;
  lineItems: LineItem[];
  collapsed: boolean;
}

interface EstimateBuilderProps {
  defaultProjectId?: string;
  initialData?: {
    id: string;
    title: string;
    label: string | null;
    projectName: string | null;
    address: string | null;
    projectId: string;
    pricingModel: string;
    currency: string;
    taxRate: number;
    discount: number;
    notes: string | null;
    clientNotes: string | null;
    validUntil: string | null;
    phases: {
      name: string;
      description: string | null;
      sortOrder: number;
      lineItems: {
        description: string;
        unit: string;
        quantity: number;
        unitPrice: number;
        sortOrder: number;
        notes: string | null;
        percentageBasis?: string | null;
        percentageRate?: number | null;
        basisPhaseName?: string | null;
        basisLineItemDesc?: string | null;
      }[];
    }[];
  };
  mode: "create" | "edit";
}

interface TemplateData {
  phases: {
    name: string;
    description: string | null;
    sortOrder: number;
    lineItems: {
      description: string;
      unit: string;
      defaultQuantity: number;
      defaultPrice: number;
      sortOrder: number;
    }[];
  }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function newKey() {
  return Math.random().toString(36).slice(2);
}

function newLineItem(): LineItem {
  return {
    _key: newKey(),
    description: "",
    unit: "hours",
    quantity: 1,
    unitPrice: 0,
    notes: "",
    percentageBasis: "",
    percentageRate: 15,
    basisPhaseName: "",
    basisLineItemKey: "",
    basisLineItemDesc: "",
  };
}

function newPhase(): Phase {
  return { _key: newKey(), name: "", description: "", lineItems: [newLineItem()], collapsed: false };
}

/** Resolve the total for a single line item, handling percentage mode.
 *  - SUBTOTAL: includes all items (fixed + resolved PHASE/LINE_ITEM percentages),
 *    but excludes other SUBTOTAL-based items to avoid circular refs.
 *  - PHASE: includes all fixed + resolved PHASE/LINE_ITEM items within the target phase,
 *    excludes SUBTOTAL-based items.
 *  - LINE_ITEM: percentage of a specific line item's resolved value.
 */
function resolveItemTotal(li: LineItem, allPhases: Phase[]): number {
  if (!li.percentageBasis) return li.quantity * li.unitPrice;

  const rate = (li.percentageRate || 0) / 100;

  if (li.percentageBasis === "SUBTOTAL") {
    // Include fixed items + resolved PHASE/LINE_ITEM items; exclude other SUBTOTAL items
    let basis = 0;
    for (const p of allPhases) {
      for (const item of p.lineItems) {
        if (item._key === li._key) continue;
        if (!item.percentageBasis) {
          basis += item.quantity * item.unitPrice;
        } else if (item.percentageBasis !== "SUBTOTAL") {
          // PHASE or LINE_ITEM — resolve their value and include
          basis += resolveItemTotal(item, allPhases);
        }
      }
    }
    return basis * rate;
  }

  if (li.percentageBasis === "PHASE") {
    const target = allPhases.find(
      (p) => p.name.trim() !== "" && p.name.trim() === li.basisPhaseName.trim()
    );
    if (!target) return 0;
    let basis = 0;
    for (const item of target.lineItems) {
      if (item._key === li._key) continue;
      if (!item.percentageBasis) {
        basis += item.quantity * item.unitPrice;
      } else if (item.percentageBasis !== "SUBTOTAL") {
        basis += resolveItemTotal(item, allPhases);
      }
    }
    return basis * rate;
  }

  if (li.percentageBasis === "LINE_ITEM") {
    for (const p of allPhases) {
      const target = p.lineItems.find((item) => item._key === li.basisLineItemKey);
      if (target) {
        const basis = !target.percentageBasis
          ? target.quantity * target.unitPrice
          : resolveItemTotal(target, allPhases);
        return basis * rate;
      }
    }
    return 0;
  }

  return 0;
}

function phaseTotal(phase: Phase, allPhases: Phase[]) {
  return phase.lineItems.reduce((sum, li) => sum + resolveItemTotal(li, allPhases), 0);
}

// ── Component ──────────────────────────────────────────────────────────────

export function EstimateBuilder({ defaultProjectId, initialData, mode }: EstimateBuilderProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  const projectId = initialData?.projectId || defaultProjectId || "";

  const [title, setTitle] = useState(initialData?.title || "");
  const [label, setLabel] = useState(initialData?.label || "");
  const [projectName, setProjectName] = useState(initialData?.projectName || "");
  const [address, setAddress] = useState(initialData?.address || "");
  const [pricingModel, setPricingModel] = useState(initialData?.pricingModel || "MIXED");
  const [currency, setCurrency] = useState(initialData?.currency || "USD");
  const [taxRate, setTaxRate] = useState(initialData?.taxRate ?? 0);
  const [discount, setDiscount] = useState(initialData?.discount ?? 0);
  const [validUntil, setValidUntil] = useState(
    initialData?.validUntil
      ? new Date(initialData.validUntil).toISOString().split("T")[0]
      : ""
  );
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [clientNotes, setClientNotes] = useState(initialData?.clientNotes || "");

  const [phases, setPhases] = useState<Phase[]>(() => {
    if (initialData?.phases && initialData.phases.length > 0) {
      // First pass: create all items with new keys
      const built = initialData.phases.map((p) => ({
        _key: newKey(),
        name: p.name,
        description: p.description || "",
        collapsed: false,
        lineItems: p.lineItems.map((li) => ({
          _key: newKey(),
          description: li.description,
          unit: li.unit,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          notes: li.notes || "",
          percentageBasis: (li.percentageBasis || "") as "" | "SUBTOTAL" | "PHASE" | "LINE_ITEM",
          percentageRate: li.percentageRate ?? 15,
          basisPhaseName: li.basisPhaseName || "",
          basisLineItemKey: "",
          basisLineItemDesc: li.basisLineItemDesc || "",
        })),
      }));
      // Second pass: resolve basisLineItemKey from basisLineItemDesc
      const allItems = built.flatMap((p) => p.lineItems);
      for (const item of allItems) {
        if (item.percentageBasis === "LINE_ITEM" && item.basisLineItemDesc) {
          const target = allItems.find(
            (x) => x._key !== item._key && x.description === item.basisLineItemDesc
          );
          if (target) item.basisLineItemKey = target._key;
        }
      }
      return built;
    }
    // Default: empty phase + Administration phase with Project Setup & Management Fee
    return [
      newPhase(),
      {
        _key: newKey(),
        name: "Administration",
        description: "",
        collapsed: false,
        lineItems: [
          {
            _key: newKey(),
            description: "Project Setup",
            unit: "units",
            quantity: 1,
            unitPrice: 500,
            notes: "",
            percentageBasis: "" as const,
            percentageRate: 15,
            basisPhaseName: "",
            basisLineItemKey: "",
            basisLineItemDesc: "",
          },
          {
            _key: newKey(),
            description: "Management Fee",
            unit: "units",
            quantity: 1,
            unitPrice: 0,
            notes: "",
            percentageBasis: "SUBTOTAL" as const,
            percentageRate: 15,
            basisPhaseName: "",
            basisLineItemKey: "",
            basisLineItemDesc: "",
          },
        ],
      },
    ];
  });

  // ── Template ───────────────────────────────────────────────────────────────

  function applyTemplate(template: TemplateData) {
    setPhases(
      template.phases.map((p) => ({
        _key: newKey(),
        name: p.name,
        description: p.description || "",
        collapsed: false,
        lineItems: p.lineItems.map((li) => ({
          _key: newKey(),
          description: li.description,
          unit: li.unit,
          quantity: li.defaultQuantity,
          unitPrice: li.defaultPrice,
          notes: "",
          percentageBasis: "" as const,
          percentageRate: 15,
          basisPhaseName: "",
          basisLineItemKey: "",
          basisLineItemDesc: "",
        })),
      }))
    );
  }

  // ── Phase helpers ──────────────────────────────────────────────────────────

  function addPhase() {
    setPhases((prev) => [...prev, newPhase()]);
  }

  function removePhase(key: string) {
    setPhases((prev) => prev.filter((p) => p._key !== key));
  }

  function updatePhase(key: string, field: "name" | "description", value: string) {
    setPhases((prev) =>
      prev.map((p) => (p._key === key ? { ...p, [field]: value } : p))
    );
  }

  function togglePhase(key: string) {
    setPhases((prev) =>
      prev.map((p) => (p._key === key ? { ...p, collapsed: !p.collapsed } : p))
    );
  }

  // ── Line item helpers ──────────────────────────────────────────────────────

  function addLineItem(phaseKey: string) {
    setPhases((prev) =>
      prev.map((p) =>
        p._key === phaseKey ? { ...p, lineItems: [...p.lineItems, newLineItem()] } : p
      )
    );
  }

  function removeLineItem(phaseKey: string, itemKey: string) {
    setPhases((prev) =>
      prev.map((p) =>
        p._key === phaseKey
          ? { ...p, lineItems: p.lineItems.filter((li) => li._key !== itemKey) }
          : p
      )
    );
  }

  function updateLineItem(
    phaseKey: string,
    itemKey: string,
    field: keyof Omit<LineItem, "_key">,
    value: string | number
  ) {
    setPhases((prev) =>
      prev.map((p) =>
        p._key === phaseKey
          ? {
              ...p,
              lineItems: p.lineItems.map((li) =>
                li._key === itemKey ? { ...li, [field]: value } : li
              ),
            }
          : p
      )
    );
  }

  function enablePercentageMode(phaseKey: string, itemKey: string) {
    setPhases((prev) =>
      prev.map((p) =>
        p._key === phaseKey
          ? {
              ...p,
              lineItems: p.lineItems.map((li) =>
                li._key === itemKey
                  ? { ...li, percentageBasis: "SUBTOTAL", percentageRate: li.percentageRate || 15, basisPhaseName: "", basisLineItemKey: "", basisLineItemDesc: "" }
                  : li
              ),
            }
          : p
      )
    );
  }

  function disablePercentageMode(phaseKey: string, itemKey: string) {
    setPhases((prev) =>
      prev.map((p) =>
        p._key === phaseKey
          ? {
              ...p,
              lineItems: p.lineItems.map((li) =>
                li._key === itemKey
                  ? { ...li, percentageBasis: "", basisPhaseName: "", basisLineItemKey: "", basisLineItemDesc: "" }
                  : li
              ),
            }
          : p
      )
    );
  }

  // ── Totals ─────────────────────────────────────────────────────────────────

  const subtotal = phases.reduce((sum, p) => sum + phaseTotal(p, phases), 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount - discount;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const sym = currencySymbol(currency);
  const totalLineCount = phases.reduce((s, p) => s + p.lineItems.length, 0);

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) { toast.error("Title is required"); return; }
    if (!projectId) { toast.error("Project ID is missing"); return; }
    for (const phase of phases) {
      if (!phase.name.trim()) { toast.error("All phases must have a name"); return; }
      for (const li of phase.lineItems) {
        if (!li.description.trim()) { toast.error("All line items must have a description"); return; }
        if (li.percentageBasis === "PHASE" && !li.basisPhaseName.trim()) {
          toast.error(`"${li.description}" is set to % of a phase but no phase is selected`);
          return;
        }
      }
    }

    setIsSubmitting(true);

    const payload = {
      title: title.trim(),
      label: label.trim() || null,
      projectName: projectName.trim() || null,
      address: address.trim() || null,
      projectId,
      pricingModel,
      currency,
      taxRate,
      discount,
      notes: notes.trim() || null,
      clientNotes: clientNotes.trim() || null,
      validUntil: validUntil || null,
      phases: phases.map((p, i) => ({
        name: p.name,
        description: p.description || null,
        sortOrder: i,
        lineItems: p.lineItems.map((li, j) => {
          const isPercentage = li.percentageBasis !== "";
          const resolvedTotal = isPercentage ? resolveItemTotal(li, phases) : null;
          const basisLabel =
            li.percentageBasis === "SUBTOTAL"
              ? "estimate subtotal"
              : li.percentageBasis === "LINE_ITEM"
              ? li.basisLineItemDesc || "line item"
              : li.basisPhaseName || "unknown";

          return {
            description: li.description,
            // Store a readable unit string so view pages display it without extra logic
            unit: isPercentage ? `${li.percentageRate}% of ${basisLabel}` : li.unit,
            // Resolve to flat amount: quantity=1, unitPrice=computed total
            quantity: isPercentage ? 1 : li.quantity,
            unitPrice: isPercentage ? (resolvedTotal ?? 0) : li.unitPrice,
            sortOrder: j,
            notes: li.notes || null,
            percentageBasis: li.percentageBasis || null,
            percentageRate: isPercentage ? li.percentageRate : null,
            basisPhaseName: li.percentageBasis === "PHASE" ? li.basisPhaseName : null,
            basisLineItemDesc: li.percentageBasis === "LINE_ITEM" ? li.basisLineItemDesc : null,
          };
        }),
      })),
    };

    try {
      const url = mode === "create" ? "/api/estimates" : `/api/estimates/${initialData?.id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save estimate");
      }

      const estimate = await res.json();
      toast.success(mode === "create" ? "Estimate created" : "Estimate saved");
      router.push(`/estimates/${estimate.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save estimate");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const monoLabel =
    "block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500 mb-1.5";

  const gridCols = "1fr 110px 90px 110px 110px 32px";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ─── ESTIMATE DETAILS ──────────────────────────────────────────── */}
      <div>
        <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
          {"// ESTIMATE DETAILS"}
        </p>
        <div
          className="bg-card-rd rounded-[14px] p-5 space-y-4"
          style={{
            border: "1px solid var(--color-hairline)",
            boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
            background: "var(--color-card-rd)",
          }}
        >
          <div>
            <label htmlFor="title" className={monoLabel}>{"// TITLE *"}</label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Estimate title"
              required
            />
          </div>

          <div>
            <label htmlFor="label" className={monoLabel}>{"// LABEL / SUB-NAME"}</label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder='e.g. "China Pricing", "US Market"'
            />
          </div>

          <div>
            <label htmlFor="projectName" className={monoLabel}>{"// PROJECT NAME"}</label>
            <Input
              id="projectName"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Project name shown on the estimate"
            />
          </div>

          <div>
            <label htmlFor="address" className={monoLabel}>{"// CLIENT ADDRESS"}</label>
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Client billing address"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={monoLabel}>{"// PRICING MODEL"}</label>
              <Select value={pricingModel} onValueChange={setPricingModel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOURLY">Hourly</SelectItem>
                  <SelectItem value="FIXED_PHASE">Fixed Phase</SelectItem>
                  <SelectItem value="DELIVERABLE">Deliverable</SelectItem>
                  <SelectItem value="MIXED">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className={monoLabel}>{"// CURRENCY"}</label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="CNY">CNY (¥)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="taxRate" className={monoLabel}>{"// TAX RATE (%)"}</label>
              <Input
                id="taxRate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div>
              <label htmlFor="discount" className={monoLabel}>{"// DISCOUNT"}</label>
              <Input
                id="discount"
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="validUntil" className={monoLabel}>{"// VALID UNTIL"}</label>
            <Input
              id="validUntil"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-48"
            />
          </div>
        </div>
      </div>

      {/* ─── PHASES & LINE ITEMS ───────────────────────────────────────── */}
      <div className="space-y-4">
        <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
          {"// PHASES & LINE ITEMS"}
        </p>

        {/* Action header */}
        <div
          className="flex items-start justify-between gap-4 flex-wrap pb-[18px]"
          style={{ borderBottom: "1px solid var(--color-hairline)" }}
        >
          <div>
            <h2 className="text-[20px] font-bold tracking-[-0.02em] m-0 mb-1 text-ink-900">
              Phases &amp; line items
            </h2>
            <p className="text-[13px] text-ink-500 m-0 max-w-[520px]">
              Group line items into execution phases. Total auto-calculates as you edit.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTemplatePickerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd"
              style={{
                background: "var(--color-canvas-cool)",
                border: "1px solid var(--color-hairline-strong)",
              }}
            >
              <Layers className="h-3.5 w-3.5" /> Use template
            </button>
            <button
              type="button"
              onClick={addPhase}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd"
              style={{
                background: "var(--color-canvas-cool)",
                border: "1px solid var(--color-hairline-strong)",
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Add phase
            </button>
          </div>
        </div>

        {phases.map((phase, phaseIdx) => (
          <div
            key={phase._key}
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
                style={{ background: "var(--color-ink-300)" }}
              />
              <span
                className="font-mono text-[11px] font-bold tracking-[0.06em] uppercase text-ink-500 flex-shrink-0"
              >
                Phase {phaseIdx + 1}
              </span>
              <input
                value={phase.name}
                onChange={(e) => updatePhase(phase._key, "name", e.target.value)}
                placeholder={`Phase ${phaseIdx + 1} name`}
                className="font-semibold text-[14px] text-ink-900 bg-transparent border-0 outline-none focus:ring-0 placeholder:text-ink-300 px-0 flex-1 min-w-0"
              />
              <span
                className="ml-auto font-mono text-[11px] tracking-[0.02em] flex-shrink-0"
                style={{ color: "var(--color-ink-500)" }}
              >
                {phase.lineItems.length} {phase.lineItems.length === 1 ? "line" : "lines"} ·{" "}
                {sym}
                <strong className="text-ink-900 font-bold rd-tabular">
                  {fmt(phaseTotal(phase, phases))}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => togglePhase(phase._key)}
                className="p-1.5 rounded-md text-ink-400 hover:text-ink-700 hover:bg-[rgba(15,23,41,0.04)] flex-shrink-0"
                aria-label={phase.collapsed ? "Expand phase" : "Collapse phase"}
              >
                {phase.collapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => removePhase(phase._key)}
                disabled={phases.length === 1}
                className="p-1.5 rounded-md text-ink-400 hover:text-warn-fg hover:bg-warn-bg disabled:opacity-40 disabled:hover:text-ink-400 disabled:hover:bg-transparent flex-shrink-0"
                aria-label="Delete phase"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* Phase description (quieter, full-width) */}
            {!phase.collapsed && (
              <div
                className="px-5 py-2"
                style={{ borderBottom: "1px solid var(--color-hairline)" }}
              >
                <input
                  value={phase.description}
                  onChange={(e) => updatePhase(phase._key, "description", e.target.value)}
                  placeholder="Phase description (optional)"
                  className="w-full text-[12px] text-ink-500 italic bg-transparent border-0 outline-none focus:ring-0 placeholder:text-ink-300 px-0"
                />
              </div>
            )}

            {!phase.collapsed && (
              <>
                {/* Column header band */}
                <div
                  className="grid gap-3 px-5 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.06em]"
                  style={{
                    gridTemplateColumns: gridCols,
                    background: "#FAFAF6",
                    borderBottom: "1px solid var(--color-hairline)",
                    color: "var(--color-ink-400)",
                  }}
                >
                  <span>Description</span>
                  <span>Unit</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Unit price</span>
                  <span className="text-right">Total</span>
                  <span></span>
                </div>

                {/* Line item rows */}
                {phase.lineItems.map((item) => {
                  const isPercent = item.percentageBasis !== "";
                  const computedTotal = resolveItemTotal(item, phases);

                  return (
                    <div key={item._key}>
                      <div
                        className="grid gap-3 items-center px-5 py-3.5 transition-colors hover:bg-[#FCFAF6]"
                        style={{
                          gridTemplateColumns: gridCols,
                          borderBottom: "1px solid var(--color-hairline)",
                        }}
                      >
                        {/* Description */}
                        <Input
                          value={item.description}
                          onChange={(e) =>
                            updateLineItem(phase._key, item._key, "description", e.target.value)
                          }
                          placeholder="Line item description"
                          className="bg-transparent border-0 shadow-none focus-visible:ring-0 px-0 h-auto py-0 text-[13px] text-ink-900 font-medium placeholder:text-ink-300"
                        />

                        {/* Unit Select — "% of..." enables percentage mode */}
                        <Select
                          value={isPercent ? "% of..." : item.unit}
                          onValueChange={(v) => {
                            if (v === "% of...") {
                              enablePercentageMode(phase._key, item._key);
                            } else {
                              disablePercentageMode(phase._key, item._key);
                              updateLineItem(phase._key, item._key, "unit", v);
                            }
                          }}
                        >
                          <SelectTrigger className="text-[12px] h-8 bg-transparent border-hairline">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hours">hours</SelectItem>
                            <SelectItem value="days">days</SelectItem>
                            <SelectItem value="sessions">sessions</SelectItem>
                            <SelectItem value="pieces">pieces</SelectItem>
                            <SelectItem value="participants">participants</SelectItem>
                            <SelectItem value="units">units</SelectItem>
                            <SelectItem value="lump sum">lump sum</SelectItem>
                            <SelectItem value="% of...">% of...</SelectItem>
                          </SelectContent>
                        </Select>

                        {isPercent ? (
                          <>
                            <span className="text-right text-[13px] text-ink-300 rd-tabular">—</span>
                            <span className="text-right text-[13px] text-ink-300 rd-tabular">—</span>
                            <span
                              className="text-right text-[13px] font-medium rd-tabular"
                              style={{ color: "var(--color-accent-rd)" }}
                            >
                              {sym}{fmt(computedTotal)}
                            </span>
                          </>
                        ) : (
                          <>
                            {/* Qty */}
                            <Input
                              type="number"
                              min="0"
                              step="0.5"
                              value={item.quantity}
                              onChange={(e) =>
                                updateLineItem(
                                  phase._key,
                                  item._key,
                                  "quantity",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="text-[13px] text-right rd-tabular text-ink-700 bg-transparent border-0 shadow-none focus-visible:ring-0 px-0 h-auto py-0"
                            />

                            {/* Unit price */}
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) =>
                                updateLineItem(
                                  phase._key,
                                  item._key,
                                  "unitPrice",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="text-[13px] text-right rd-tabular text-ink-700 bg-transparent border-0 shadow-none focus-visible:ring-0 px-0 h-auto py-0"
                            />

                            {/* Total */}
                            <span className="text-right text-[13px] font-medium rd-tabular text-ink-900">
                              {sym}{fmt(item.quantity * item.unitPrice)}
                            </span>
                          </>
                        )}

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => removeLineItem(phase._key, item._key)}
                          disabled={phase.lineItems.length === 1}
                          className="p-1.5 rounded-md text-ink-300 hover:text-warn-fg hover:bg-warn-bg disabled:opacity-40 disabled:hover:text-ink-300 disabled:hover:bg-transparent justify-self-end"
                          aria-label="Delete line item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Percentage controls — sub-row beneath the line */}
                      {isPercent && (
                        <div
                          className="px-5 pb-3 pt-1 flex items-center gap-3 text-[11px] text-ink-500"
                          style={{ borderBottom: "1px solid var(--color-hairline)" }}
                        >
                          <span className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400">
                            {"//"}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={item.percentageRate}
                              onChange={(e) =>
                                updateLineItem(
                                  phase._key,
                                  item._key,
                                  "percentageRate",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="text-[11px] h-7 w-20 rd-tabular"
                              placeholder="Rate"
                            />
                            <span className="text-ink-400">%</span>
                          </div>
                          <span className="text-ink-400">of</span>
                          <Select
                            value={
                              item.percentageBasis === "SUBTOTAL"
                                ? "SUBTOTAL"
                                : item.percentageBasis === "LINE_ITEM"
                                ? `ITEM:${item.basisLineItemKey}`
                                : `PHASE:${item.basisPhaseName}`
                            }
                            onValueChange={(v) => {
                              setPhases((prev) =>
                                prev.map((p) =>
                                  p._key === phase._key
                                    ? {
                                        ...p,
                                        lineItems: p.lineItems.map((li) => {
                                          if (li._key !== item._key) return li;
                                          if (v === "SUBTOTAL") {
                                            return { ...li, percentageBasis: "SUBTOTAL" as const, basisPhaseName: "", basisLineItemKey: "", basisLineItemDesc: "" };
                                          }
                                          if (v.startsWith("ITEM:")) {
                                            const targetKey = v.replace(/^ITEM:/, "");
                                            let desc = "";
                                            for (const ph of prev) {
                                              const found = ph.lineItems.find((x) => x._key === targetKey);
                                              if (found) { desc = found.description; break; }
                                            }
                                            return { ...li, percentageBasis: "LINE_ITEM" as const, basisPhaseName: "", basisLineItemKey: targetKey, basisLineItemDesc: desc };
                                          }
                                          const phaseName = v.replace(/^PHASE:/, "");
                                          return { ...li, percentageBasis: "PHASE" as const, basisPhaseName: phaseName, basisLineItemKey: "", basisLineItemDesc: "" };
                                        }),
                                      }
                                    : p
                                )
                              );
                            }}
                          >
                            <SelectTrigger className="text-[11px] h-7 w-[240px]">
                              <SelectValue placeholder="of…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="SUBTOTAL">Estimate subtotal</SelectItem>
                              {phases
                                .filter((p) => p.name.trim() !== "")
                                .map((p) => (
                                  <SelectItem key={`phase-${p._key}`} value={`PHASE:${p.name}`}>
                                    Phase: {p.name}
                                  </SelectItem>
                                ))}
                              {phases.flatMap((p) =>
                                p.lineItems
                                  .filter((li) => li._key !== item._key && li.description.trim() !== "" && !li.percentageBasis)
                                  .map((li) => (
                                    <SelectItem key={`item-${li._key}`} value={`ITEM:${li._key}`}>
                                      Item: {li.description}
                                    </SelectItem>
                                  ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add line item */}
                <button
                  type="button"
                  onClick={() => addLineItem(phase._key)}
                  className="px-5 py-3 w-full text-left font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 hover:text-accent-rd hover:bg-[#FCFAF6]"
                >
                  + Add line item
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ─── NOTES ─────────────────────────────────────────────────────── */}
      <div>
        <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
          {"// NOTES"}
        </p>
        <div
          className="bg-card-rd rounded-[14px] p-5 space-y-4"
          style={{
            border: "1px solid var(--color-hairline)",
            boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
            background: "var(--color-card-rd)",
          }}
        >
          <div>
            <label htmlFor="notes" className={monoLabel}>{"// INTERNAL NOTES"}</label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes (not shown to client)"
              rows={3}
            />
          </div>
          <div>
            <label htmlFor="clientNotes" className={monoLabel}>{"// CLIENT NOTES"}</label>
            <Textarea
              id="clientNotes"
              value={clientNotes}
              onChange={(e) => setClientNotes(e.target.value)}
              placeholder="Notes visible to client"
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* ─── TOTALS ────────────────────────────────────────────────────── */}
      <div>
        <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
          {"// TOTALS"}
        </p>
        <div
          className="bg-card-rd rounded-[14px] p-5"
          style={{
            border: "1px solid var(--color-hairline)",
            boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
            background: "var(--color-card-rd)",
          }}
        >
          <div className="max-w-xs ml-auto space-y-1.5">
            <div className="flex justify-between items-baseline">
              <span className="text-[12px] text-ink-500">Subtotal</span>
              <span className="font-mono rd-tabular text-[13px] text-ink-700">
                {sym}{fmt(subtotal)}
              </span>
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between items-baseline">
                <span className="text-[12px] text-ink-500">Tax ({taxRate}%)</span>
                <span className="font-mono rd-tabular text-[13px] text-ink-700">
                  {sym}{fmt(taxAmount)}
                </span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between items-baseline">
                <span className="text-[12px] text-ink-500">Discount</span>
                <span className="font-mono rd-tabular text-[13px] text-warn-fg">
                  − {sym}{fmt(discount)}
                </span>
              </div>
            )}
            <div
              className="flex justify-between items-baseline pt-2 mt-2"
              style={{ borderTop: "1px solid var(--color-hairline)" }}
            >
              <span className="text-[13px] font-bold text-ink-900">Total</span>
              <span
                className="font-mono rd-tabular text-[16px] font-bold"
                style={{ color: "var(--color-accent-rd)" }}
              >
                {sym}{fmt(total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── ACTION FOOTER ─────────────────────────────────────────────── */}
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
        <div className="text-[12px] text-ink-500">
          <strong className="text-ink-900 font-bold rd-tabular">{phases.length}</strong> phases ·{" "}
          <strong className="text-ink-900 font-bold rd-tabular">{totalLineCount}</strong> lines · total{" "}
          <strong
            className="font-bold rd-tabular"
            style={{ color: "var(--color-accent-rd)" }}
          >
            {sym}{fmt(total)}
          </strong>
        </div>
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={isSubmitting}
            className="px-3 py-2 rounded-lg text-[13px] font-medium text-ink-700 hover:bg-[rgba(15,23,41,0.04)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white tracking-[-0.005em] disabled:opacity-50"
            style={{
              background: "var(--color-accent-rd)",
              boxShadow: "0 4px 12px -2px rgba(217, 82, 43, 0.32)",
            }}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "create" ? "Create estimate" : "Save changes"}
          </button>
        </div>
      </div>

      <TemplatePicker
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        onSelect={applyTemplate}
      />
    </form>
  );
}
