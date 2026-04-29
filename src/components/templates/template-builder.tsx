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
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  Plus,
  Trash2,
  Loader2,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface TemplateLineItem {
  _key: string;
  description: string;
  unit: string;
  defaultQuantity: number;
  defaultPrice: number;
}

interface TemplatePhase {
  _key: string;
  name: string;
  description: string;
  lineItems: TemplateLineItem[];
  collapsed: boolean;
}

interface TemplateBuilderProps {
  initialData?: {
    id: string;
    name: string;
    description: string | null;
    pricingModel: string;
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
  };
  mode: "create" | "edit";
}

const LINE_GRID = "24px 1fr 90px 90px 110px 110px 32px";

function newKey() {
  return Math.random().toString(36).slice(2);
}

function newLineItem(): TemplateLineItem {
  return {
    _key: newKey(),
    description: "",
    unit: "hours",
    defaultQuantity: 1,
    defaultPrice: 0,
  };
}

function newPhase(): TemplatePhase {
  return {
    _key: newKey(),
    name: "",
    description: "",
    lineItems: [newLineItem()],
    collapsed: false,
  };
}

function phaseTotal(phase: TemplatePhase) {
  return phase.lineItems.reduce((sum, li) => sum + li.defaultQuantity * li.defaultPrice, 0);
}

function SortablePhase({
  phase,
  children,
}: {
  phase: TemplatePhase;
  children: (handle: {
    listeners: ReturnType<typeof useSortable>["listeners"];
    attributes: ReturnType<typeof useSortable>["attributes"];
  }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: phase._key,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ listeners, attributes })}
    </div>
  );
}

function SortableLine({
  item,
  children,
}: {
  item: TemplateLineItem;
  children: (handle: {
    listeners: ReturnType<typeof useSortable>["listeners"];
    attributes: ReturnType<typeof useSortable>["attributes"];
  }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item._key,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ listeners, attributes })}
    </div>
  );
}

export function TemplateBuilder({ initialData, mode }: TemplateBuilderProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [pricingModel, setPricingModel] = useState(initialData?.pricingModel || "MIXED");

  const [phases, setPhases] = useState<TemplatePhase[]>(() => {
    if (initialData?.phases && initialData.phases.length > 0) {
      return initialData.phases.map((p) => ({
        _key: newKey(),
        name: p.name,
        description: p.description || "",
        collapsed: false,
        lineItems: p.lineItems.map((li) => ({
          _key: newKey(),
          description: li.description,
          unit: li.unit,
          defaultQuantity: li.defaultQuantity,
          defaultPrice: li.defaultPrice,
        })),
      }));
    }
    return [newPhase()];
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function addPhase() {
    setPhases((prev) => [...prev, newPhase()]);
  }
  function removePhase(key: string) {
    setPhases((prev) => prev.filter((p) => p._key !== key));
  }
  function updatePhase(key: string, field: "name" | "description", value: string) {
    setPhases((prev) => prev.map((p) => (p._key === key ? { ...p, [field]: value } : p)));
  }
  function togglePhase(key: string) {
    setPhases((prev) =>
      prev.map((p) => (p._key === key ? { ...p, collapsed: !p.collapsed } : p)),
    );
  }
  function addLineItem(phaseKey: string) {
    setPhases((prev) =>
      prev.map((p) =>
        p._key === phaseKey ? { ...p, lineItems: [...p.lineItems, newLineItem()] } : p,
      ),
    );
  }
  function removeLineItem(phaseKey: string, itemKey: string) {
    setPhases((prev) =>
      prev.map((p) =>
        p._key === phaseKey
          ? { ...p, lineItems: p.lineItems.filter((li) => li._key !== itemKey) }
          : p,
      ),
    );
  }
  function updateLineItem(
    phaseKey: string,
    itemKey: string,
    field: keyof Omit<TemplateLineItem, "_key">,
    value: string | number,
  ) {
    setPhases((prev) =>
      prev.map((p) =>
        p._key === phaseKey
          ? {
              ...p,
              lineItems: p.lineItems.map((li) =>
                li._key === itemKey ? { ...li, [field]: value } : li,
              ),
            }
          : p,
      ),
    );
  }
  function onPhaseDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setPhases((prev) => {
      const oldIdx = prev.findIndex((p) => p._key === active.id);
      const newIdx = prev.findIndex((p) => p._key === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  }
  function onLineDragEnd(phaseKey: string, e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setPhases((prev) =>
      prev.map((p) => {
        if (p._key !== phaseKey) return p;
        const oldIdx = p.lineItems.findIndex((li) => li._key === active.id);
        const newIdx = p.lineItems.findIndex((li) => li._key === over.id);
        return { ...p, lineItems: arrayMove(p.lineItems, oldIdx, newIdx) };
      }),
    );
  }

  const estimatedTotal = phases.reduce((sum, p) => sum + phaseTotal(p), 0);
  const totalLines = phases.reduce((s, p) => s + p.lineItems.length, 0);

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }
    for (const phase of phases) {
      if (!phase.name.trim()) {
        toast.error("All phases must have a name");
        return;
      }
      for (const li of phase.lineItems) {
        if (!li.description.trim()) {
          toast.error("All line items must have a description");
          return;
        }
      }
    }

    setIsSubmitting(true);

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      pricingModel,
      phases: phases.map((p, i) => ({
        name: p.name,
        description: p.description || null,
        sortOrder: i,
        lineItems: p.lineItems.map((li, j) => ({
          description: li.description,
          unit: li.unit,
          defaultQuantity: li.defaultQuantity,
          defaultPrice: li.defaultPrice,
          sortOrder: j,
        })),
      })),
    };

    try {
      const url = mode === "create" ? "/api/templates" : `/api/templates/${initialData?.id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save template");
      }

      const template = await res.json();
      toast.success(mode === "create" ? "Template created" : "Template saved");
      router.push(`/templates/${template.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save template");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Template info */}
      <div>
        <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
          {"// TEMPLATE INFO"}
        </p>
        <div
          className="bg-card-rd rounded-[14px] p-5 space-y-4"
          style={{
            border: "1px solid var(--color-hairline)",
            boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
          }}
        >
          <div className="space-y-1.5">
            <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
              {"// NAME *"}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard UX Research Study"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
              {"// DESCRIPTION"}
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What kind of project is this template for?"
              rows={2}
            />
          </div>
          <div className="space-y-1.5 w-48">
            <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
              {"// PRICING MODEL"}
            </label>
            <Select value={pricingModel} onValueChange={setPricingModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HOURLY">Hourly</SelectItem>
                <SelectItem value="FIXED_PHASE">Fixed Phase</SelectItem>
                <SelectItem value="DELIVERABLE">Deliverable</SelectItem>
                <SelectItem value="MIXED">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Phases */}
      <div>
        <div
          className="flex items-start justify-between gap-4 flex-wrap pb-3 mb-3"
          style={{ borderBottom: "1px solid var(--color-hairline)" }}
        >
          <div>
            <h2 className="text-[20px] font-bold tracking-[-0.02em] m-0 mb-1 text-ink-900">
              Phases & default items
            </h2>
            <p className="text-[13px] text-ink-500 m-0 max-w-[520px]">
              Drag to reorder. Default quantities and prices populate the estimate when this
              template is applied.
            </p>
          </div>
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

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={onPhaseDragEnd}
        >
          <SortableContext
            items={phases.map((p) => p._key)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {phases.map((phase, phaseIdx) => (
                <SortablePhase key={phase._key} phase={phase}>
                  {(phaseHandle) => (
                    <div
                      className="bg-card-rd rounded-[14px] overflow-hidden"
                      style={{
                        border: "1px solid var(--color-hairline)",
                        boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
                      }}
                    >
                      {/* Head */}
                      <div
                        className="px-5 py-3.5 flex items-center gap-3"
                        style={{
                          borderBottom: "1px solid var(--color-hairline)",
                          background: "linear-gradient(180deg, #FCFAF6 0%, #FFFFFF 100%)",
                        }}
                      >
                        <button
                          type="button"
                          {...phaseHandle.listeners}
                          {...phaseHandle.attributes}
                          className="text-ink-200 hover:text-ink-500 cursor-grab active:cursor-grabbing -ml-1 px-1 py-1 rounded hover:bg-[#FCFAF6]"
                          aria-label="Drag to reorder phase"
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: "var(--color-ink-300)" }}
                        />
                        <span className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
                          {`Phase ${phaseIdx + 1}`}
                        </span>
                        <Input
                          value={phase.name}
                          onChange={(e) => updatePhase(phase._key, "name", e.target.value)}
                          placeholder="Phase name"
                          className="font-semibold text-[14px] text-ink-900 bg-transparent border-0 outline-none focus-visible:ring-0 px-0 placeholder:text-ink-300 shadow-none h-8"
                        />
                        <span className="ml-auto font-mono text-[11px] tracking-[0.02em] text-ink-500">
                          {phase.lineItems.length}{" "}
                          {phase.lineItems.length === 1 ? "line" : "lines"} ·{" "}
                          <strong className="text-ink-900 font-bold rd-tabular">
                            ${fmt(phaseTotal(phase))}
                          </strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePhase(phase._key)}
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-ink-500 hover:bg-[#FCFAF6]"
                          aria-label={phase.collapsed ? "Expand" : "Collapse"}
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
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-ink-300 hover:text-warn-fg hover:bg-warn-bg disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label="Remove phase"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Phase description */}
                      <div
                        className="px-5 py-2"
                        style={{ borderBottom: "1px solid var(--color-hairline)" }}
                      >
                        <Input
                          value={phase.description}
                          onChange={(e) =>
                            updatePhase(phase._key, "description", e.target.value)
                          }
                          placeholder="Phase description (optional)"
                          className="text-[12px] text-ink-500 italic bg-transparent border-0 outline-none focus-visible:ring-0 px-0 placeholder:text-ink-300 shadow-none h-7"
                        />
                      </div>

                      {!phase.collapsed && (
                        <>
                          {/* Column header band */}
                          <div
                            className="grid gap-3 px-5 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.06em]"
                            style={{
                              gridTemplateColumns: LINE_GRID,
                              background: "#FAFAF6",
                              borderBottom: "1px solid var(--color-hairline)",
                              color: "var(--color-ink-400)",
                            }}
                          >
                            <span></span>
                            <span>Description</span>
                            <span>Unit</span>
                            <span className="text-right">Default qty</span>
                            <span className="text-right">Default price</span>
                            <span className="text-right">Total</span>
                            <span></span>
                          </div>

                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            modifiers={[restrictToVerticalAxis]}
                            onDragEnd={(e) => onLineDragEnd(phase._key, e)}
                          >
                            <SortableContext
                              items={phase.lineItems.map((li) => li._key)}
                              strategy={verticalListSortingStrategy}
                            >
                              {phase.lineItems.map((item, i) => (
                                <SortableLine key={item._key} item={item}>
                                  {(lineHandle) => (
                                    <div
                                      className="grid gap-3 items-center px-5 py-2.5 hover:bg-[#FCFAF6] transition-colors"
                                      style={{
                                        gridTemplateColumns: LINE_GRID,
                                        borderBottom:
                                          i < phase.lineItems.length - 1
                                            ? "1px solid var(--color-hairline)"
                                            : "none",
                                      }}
                                    >
                                      <button
                                        type="button"
                                        {...lineHandle.listeners}
                                        {...lineHandle.attributes}
                                        className="text-ink-200 hover:text-ink-500 cursor-grab active:cursor-grabbing -ml-1 px-1 py-1 rounded hover:bg-[#FCFAF6]"
                                        aria-label="Drag to reorder line"
                                      >
                                        <GripVertical className="h-4 w-4" />
                                      </button>
                                      <Input
                                        value={item.description}
                                        onChange={(e) =>
                                          updateLineItem(
                                            phase._key,
                                            item._key,
                                            "description",
                                            e.target.value,
                                          )
                                        }
                                        placeholder="Item description"
                                        className="bg-transparent border-0 outline-none focus-visible:ring-0 px-0 text-[13px] text-ink-900 font-medium placeholder:text-ink-300 shadow-none h-8"
                                      />
                                      <Select
                                        value={item.unit}
                                        onValueChange={(v) =>
                                          updateLineItem(phase._key, item._key, "unit", v)
                                        }
                                      >
                                        <SelectTrigger className="text-[12px] h-8">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="hours">hours</SelectItem>
                                          <SelectItem value="days">days</SelectItem>
                                          <SelectItem value="sessions">sessions</SelectItem>
                                          <SelectItem value="pieces">pieces</SelectItem>
                                          <SelectItem value="participants">
                                            participants
                                          </SelectItem>
                                          <SelectItem value="units">units</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        value={item.defaultQuantity}
                                        onChange={(e) =>
                                          updateLineItem(
                                            phase._key,
                                            item._key,
                                            "defaultQuantity",
                                            parseFloat(e.target.value) || 0,
                                          )
                                        }
                                        className="text-right text-[13px] text-ink-700 rd-tabular h-8"
                                      />
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={item.defaultPrice}
                                        onChange={(e) =>
                                          updateLineItem(
                                            phase._key,
                                            item._key,
                                            "defaultPrice",
                                            parseFloat(e.target.value) || 0,
                                          )
                                        }
                                        className="text-right text-[13px] text-ink-700 rd-tabular h-8"
                                      />
                                      <div className="text-right text-[13px] font-medium text-ink-900 rd-tabular">
                                        ${fmt(item.defaultQuantity * item.defaultPrice)}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => removeLineItem(phase._key, item._key)}
                                        disabled={phase.lineItems.length === 1}
                                        className="h-8 w-8 flex items-center justify-center rounded-lg text-ink-300 hover:text-warn-fg hover:bg-warn-bg disabled:opacity-30 disabled:cursor-not-allowed"
                                        aria-label="Remove line item"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </SortableLine>
                              ))}
                            </SortableContext>
                          </DndContext>

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
                  )}
                </SortablePhase>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Estimated total */}
      <div>
        <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
          {"// ESTIMATED DEFAULT TOTAL"}
        </p>
        <div
          className="bg-card-rd rounded-[14px] p-5"
          style={{
            border: "1px solid var(--color-hairline)",
            boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
          }}
        >
          <div className="max-w-xs ml-auto flex justify-between items-center">
            <span className="text-[13px] font-bold text-ink-900">Total</span>
            <span className="font-mono rd-tabular text-[16px] font-bold text-accent-rd">
              ${fmt(estimatedTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* Sticky action footer */}
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
          <strong className="text-ink-900 font-bold rd-tabular">{phases.length}</strong>{" "}
          {phases.length === 1 ? "phase" : "phases"} ·{" "}
          <strong className="text-ink-900 font-bold rd-tabular">{totalLines}</strong>{" "}
          {totalLines === 1 ? "line" : "lines"} · default total{" "}
          <strong className="text-accent-rd font-bold rd-tabular">${fmt(estimatedTotal)}</strong>
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
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "Create template" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
