"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2, GripVertical, ChevronDown, ChevronUp, Layers } from "lucide-react";
import { TemplatePicker } from "./template-picker";

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
    new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div>
        <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-2">
          {"// ESTIMATE DETAILS"}
        </p>
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Estimate title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="label">Label / Sub-name</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder='e.g. "China Pricing", "US Market"'
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="projectName">Project Name</Label>
            <Input
              id="projectName"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Project name shown on the estimate"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Client Address</Label>
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Client billing address"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Pricing Model</Label>
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

            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="CNY">CNY (¥)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxRate">Tax Rate (%)</Label>
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

            <div className="space-y-2">
              <Label htmlFor="discount">Discount</Label>
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

          <div className="space-y-2">
            <Label htmlFor="validUntil">Valid Until</Label>
            <Input
              id="validUntil"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-48"
            />
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Phases */}
      <div className="space-y-4">
        <div>
          <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-2">
            {"// PHASES & LINE ITEMS"}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-900">Phases & Line Items</h2>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTemplatePickerOpen(true)}
            >
              <Layers className="h-4 w-4 mr-2" />
              Use Template
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={addPhase}>
              <Plus className="h-4 w-4 mr-2" />
              Add Phase
            </Button>
          </div>
        </div>

        {phases.map((phase, phaseIdx) => (
          <Card key={phase._key}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-ink-200 shrink-0" />
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    value={phase.name}
                    onChange={(e) => updatePhase(phase._key, "name", e.target.value)}
                    placeholder={`Phase ${phaseIdx + 1} name`}
                    className="font-medium"
                  />
                  <Input
                    value={phase.description}
                    onChange={(e) => updatePhase(phase._key, "description", e.target.value)}
                    placeholder="Description (optional)"
                  />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-sm font-medium font-mono text-ink-700 mr-2">
                    <span className="text-ink-400 mr-1">{currency}</span>{fmt(phaseTotal(phase, phases))}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => togglePhase(phase._key)}
                  >
                    {phase.collapsed ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronUp className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePhase(phase._key)}
                    className="hover:text-warn-fg hover:bg-warn-bg"
                    disabled={phases.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {!phase.collapsed && (
              <CardContent className="pt-0">
                <Separator className="mb-4" />

                {/* Column headers */}
                <div className="grid grid-cols-12 gap-2 mb-2 px-1">
                  <div className="col-span-4 text-xs font-medium text-ink-500 font-mono uppercase tracking-[0.04em]">DESCRIPTION</div>
                  <div className="col-span-2 text-xs font-medium text-ink-500 font-mono uppercase tracking-[0.04em]">UNIT</div>
                  <div className="col-span-2 text-xs font-medium text-ink-500 font-mono uppercase tracking-[0.04em]">QTY</div>
                  <div className="col-span-2 text-xs font-medium text-ink-500 font-mono uppercase tracking-[0.04em]">UNIT PRICE</div>
                  <div className="col-span-1 text-xs font-medium text-ink-500 font-mono uppercase tracking-[0.04em] text-right">TOTAL</div>
                  <div className="col-span-1" />
                </div>

                <div className="space-y-2">
                  {phase.lineItems.map((item) => {
                    const isPercent = item.percentageBasis !== "";
                    const computedTotal = resolveItemTotal(item, phases);

                    return (
                      <div key={item._key} className="space-y-1">
                        <div className="grid grid-cols-12 gap-2 items-center">
                          {/* Description */}
                          <div className="col-span-4">
                            <Input
                              value={item.description}
                              onChange={(e) =>
                                updateLineItem(phase._key, item._key, "description", e.target.value)
                              }
                              placeholder="Line item description"
                              className="text-sm"
                            />
                          </div>

                          {/* Unit Select — always shown; "% of..." enables percentage mode */}
                          <div className="col-span-2">
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
                              <SelectTrigger className="text-sm">
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
                          </div>

                          {isPercent ? (
                            <>
                              {/* Qty + Unit Price columns empty for alignment */}
                              <div className="col-span-4" />

                              {/* Computed total — same position as normal total */}
                              <div className="col-span-1 text-right">
                                <span className="text-sm font-medium text-blue-700">
                                  {fmt(computedTotal)}
                                </span>
                              </div>
                            </>
                          ) : (
                            <>
                              {/* Qty */}
                              <div className="col-span-2">
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
                                  className="text-sm"
                                />
                              </div>

                              {/* Unit price */}
                              <div className="col-span-2">
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
                                  className="text-sm"
                                />
                              </div>

                              {/* Total */}
                              <div className="col-span-1 text-right">
                                <span className="text-sm font-medium font-mono text-ink-700">
                                  {fmt(item.quantity * item.unitPrice)}
                                </span>
                              </div>
                            </>
                          )}

                          {/* Actions: delete only */}
                          <div className="col-span-1 flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLineItem(phase._key, item._key)}
                              className="h-7 w-7 text-ink-400 hover:text-warn-fg hover:bg-warn-bg"
                              disabled={phase.lineItems.length === 1}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Percentage controls — second row, indented under description */}
                        {isPercent && (
                          <div className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-4" />
                            <div className="col-span-2 flex items-center gap-1">
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
                                className="text-sm"
                                placeholder="Rate"
                              />
                              <span className="text-xs text-ink-400 shrink-0">%</span>
                            </div>
                            <div className="col-span-3">
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
                                <SelectTrigger className="text-sm">
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
                            <div className="col-span-3" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-3 text-ink-500 font-mono text-[11px] tracking-[0.04em] uppercase"
                  onClick={() => addLineItem(phase._key)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add line item
                </Button>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Notes */}
      <div>
        <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-2">
          {"// NOTES"}
        </p>
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Internal Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes (not shown to client)"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientNotes">Client Notes</Label>
            <Textarea
              id="clientNotes"
              value={clientNotes}
              onChange={(e) => setClientNotes(e.target.value)}
              placeholder="Notes visible to client"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Totals */}
      <div>
        <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-2">
          {"// TOTALS"}
        </p>
      <Card>
        <CardContent className="pt-6">
          <div className="max-w-xs ml-auto space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-ink-700">Subtotal</span>
              <span className="font-medium font-mono">{currency} {fmt(subtotal)}</span>
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-ink-700">Tax ({taxRate}%)</span>
                <span className="font-medium font-mono">{currency} {fmt(taxAmount)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-ink-700">Discount</span>
                <span className="font-medium font-mono text-warn-fg">− {currency} {fmt(discount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between">
              <span className="font-semibold text-ink-900">Total</span>
              <span className="font-bold text-lg font-mono text-accent-rd">{currency} {fmt(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="bg-accent-rd text-white hover:bg-accent-rd/90">
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {mode === "create" ? "Create Estimate" : "Save Changes"}
        </Button>
      </div>

      <TemplatePicker
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        onSelect={applyTemplate}
      />
    </form>
  );
}
