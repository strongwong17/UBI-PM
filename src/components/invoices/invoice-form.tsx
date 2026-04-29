"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
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
import { GripVertical, Plus, Trash2, Loader2 } from "lucide-react";

interface Project {
  id: string;
  projectNumber: string;
  title: string;
  client: { company: string };
}

interface LineItemInput {
  _key: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceFormProps {
  defaultProjectId?: string;
}

function newKey() {
  return Math.random().toString(36).slice(2);
}

const GRID_COLS = "24px 1fr 90px 130px 130px 32px";

function SortableLine({
  item,
  children,
}: {
  item: LineItemInput;
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

export function InvoiceForm({ defaultProjectId }: InvoiceFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

  const [projectId, setProjectId] = useState(defaultProjectId || "");
  const [issuedDate, setIssuedDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItemInput[]>(() => [
    { _key: newKey(), description: "", quantity: 1, unitPrice: 0 },
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch("/api/projects");
        if (res.ok) {
          const data = await res.json();
          setProjects(data);
        }
      } catch {
        toast.error("Failed to load projects");
      }
    }
    fetchProjects();
  }, []);

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      { _key: newKey(), description: "", quantity: 1, unitPrice: 0 },
    ]);
  }

  function removeLineItem(key: string) {
    setLineItems((prev) => prev.filter((li) => li._key !== key));
  }

  function updateLineItem(
    key: string,
    field: "description" | "quantity" | "unitPrice",
    value: string | number,
  ) {
    setLineItems((prev) => prev.map((li) => (li._key === key ? { ...li, [field]: value } : li)));
  }

  function onLineDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setLineItems((prev) => {
      const oldIdx = prev.findIndex((li) => li._key === active.id);
      const newIdx = prev.findIndex((li) => li._key === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) {
      toast.error("Please select a project");
      return;
    }
    for (const li of lineItems) {
      if (!li.description.trim()) {
        toast.error("All line items must have a description");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          issuedDate: issuedDate || null,
          dueDate: dueDate || null,
          taxRate,
          notes: notes.trim() || null,
          contactEmail: contactEmail.trim() || null,
          lineItems: lineItems.map((li, i) => ({
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            sortOrder: i,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create invoice");
      }

      const invoice = await res.json();
      toast.success("Invoice created");
      router.push(`/invoices/${invoice.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create invoice");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Invoice details */}
      <div>
        <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
          {"// INVOICE DETAILS"}
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
              {"// PROJECT *"}
            </label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.projectNumber} — {p.title} ({p.client.company})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
                {"// ISSUE DATE"}
              </label>
              <Input
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
                {"// DUE DATE"}
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
                {"// TAX RATE (%)"}
              </label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
              {"// CONTACT EMAIL"}
            </label>
            <Input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="billing@client.com"
            />
          </div>
        </div>
      </div>

      {/* Line items */}
      <div>
        <div
          className="flex items-start justify-between gap-4 flex-wrap pb-3 mb-3"
          style={{ borderBottom: "1px solid var(--color-hairline)" }}
        >
          <div>
            <h2 className="text-[20px] font-bold tracking-[-0.02em] m-0 mb-1 text-ink-900">
              Line items
            </h2>
            <p className="text-[13px] text-ink-500 m-0 max-w-[520px]">
              Drag to reorder. Subtotals update as you edit.
            </p>
          </div>
          <button
            type="button"
            onClick={addLineItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd"
            style={{
              background: "var(--color-canvas-cool)",
              border: "1px solid var(--color-hairline-strong)",
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Add item
          </button>
        </div>

        <div
          className="bg-card-rd rounded-[14px] overflow-hidden"
          style={{
            border: "1px solid var(--color-hairline)",
            boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
          }}
        >
          {/* Column header band */}
          <div
            className="grid gap-3 px-5 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.06em]"
            style={{
              gridTemplateColumns: GRID_COLS,
              background: "#FAFAF6",
              borderBottom: "1px solid var(--color-hairline)",
              color: "var(--color-ink-400)",
            }}
          >
            <span></span>
            <span>Description</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Unit price</span>
            <span className="text-right">Total</span>
            <span></span>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={onLineDragEnd}
          >
            <SortableContext
              items={lineItems.map((li) => li._key)}
              strategy={verticalListSortingStrategy}
            >
              {lineItems.map((item, i) => (
                <SortableLine key={item._key} item={item}>
                  {(handle) => (
                    <div
                      className="grid gap-3 items-center px-5 py-2.5 hover:bg-[#FCFAF6] transition-colors"
                      style={{
                        gridTemplateColumns: GRID_COLS,
                        borderBottom:
                          i < lineItems.length - 1 ? "1px solid var(--color-hairline)" : "none",
                      }}
                    >
                      <button
                        type="button"
                        {...handle.listeners}
                        {...handle.attributes}
                        className="text-ink-200 hover:text-ink-500 cursor-grab active:cursor-grabbing -ml-1 px-1 py-1 rounded hover:bg-[#FCFAF6]"
                        aria-label="Drag to reorder"
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                      <Input
                        value={item.description}
                        onChange={(e) =>
                          updateLineItem(item._key, "description", e.target.value)
                        }
                        placeholder="Description"
                        className="bg-transparent border-0 outline-none focus:ring-0 px-0 text-[13px] text-ink-900 font-medium placeholder:text-ink-300 shadow-none h-8"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={item.quantity}
                        onChange={(e) =>
                          updateLineItem(item._key, "quantity", parseFloat(e.target.value) || 0)
                        }
                        className="text-right text-[13px] text-ink-700 rd-tabular h-8"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateLineItem(item._key, "unitPrice", parseFloat(e.target.value) || 0)
                        }
                        className="text-right text-[13px] text-ink-700 rd-tabular h-8"
                      />
                      <div className="text-right text-[13px] font-medium text-ink-900 rd-tabular">
                        ${fmt(item.quantity * item.unitPrice)}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLineItem(item._key)}
                        disabled={lineItems.length === 1}
                        className="text-ink-300 hover:text-warn-fg hover:bg-warn-bg disabled:opacity-30 disabled:cursor-not-allowed h-8 w-8 flex items-center justify-center rounded"
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
            onClick={addLineItem}
            className="px-5 py-3 w-full text-left font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 hover:text-accent-rd hover:bg-[#FCFAF6]"
          >
            + Add line item
          </button>
        </div>
      </div>

      {/* Totals */}
      <div>
        <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
          {"// TOTALS"}
        </p>
        <div
          className="bg-card-rd rounded-[14px] p-5"
          style={{
            border: "1px solid var(--color-hairline)",
            boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
          }}
        >
          <div className="max-w-xs ml-auto space-y-1.5">
            <div className="flex justify-between text-[12px]">
              <span className="text-ink-500">Subtotal</span>
              <span className="font-mono rd-tabular text-ink-700">${fmt(subtotal)}</span>
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between text-[12px]">
                <span className="text-ink-500">Tax ({taxRate}%)</span>
                <span className="font-mono rd-tabular text-ink-700">${fmt(tax)}</span>
              </div>
            )}
            <div
              className="flex justify-between pt-2 mt-2"
              style={{ borderTop: "1px solid var(--color-hairline)" }}
            >
              <span className="text-[13px] font-bold text-ink-900">Total</span>
              <span className="font-mono rd-tabular text-[16px] font-bold text-accent-rd">
                ${fmt(total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
          {"// NOTES"}
        </p>
        <div
          className="bg-card-rd rounded-[14px] p-5"
          style={{
            border: "1px solid var(--color-hairline)",
            boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
          }}
        >
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Payment instructions, terms, or other notes..."
            rows={4}
            className="w-full px-3 py-2 rounded-md text-[13px] text-ink-900 placeholder:text-ink-300 outline-none focus:ring-2 focus:ring-ink-900/10"
            style={{
              background: "var(--color-card-rd)",
              border: "1px solid var(--color-hairline)",
            }}
          />
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
          <strong className="text-ink-900 font-bold rd-tabular">{lineItems.length}</strong>{" "}
          {lineItems.length === 1 ? "line" : "lines"} · total{" "}
          <strong className="text-accent-rd font-bold rd-tabular">${fmt(total)}</strong>
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
            Create invoice
          </button>
        </div>
      </div>
    </form>
  );
}
