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
import { Plus, Trash2, Loader2, GripVertical, ChevronDown, ChevronUp } from "lucide-react";

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

function newKey() {
  return Math.random().toString(36).slice(2);
}

function newLineItem(): TemplateLineItem {
  return { _key: newKey(), description: "", unit: "hours", defaultQuantity: 1, defaultPrice: 0 };
}

function newPhase(): TemplatePhase {
  return { _key: newKey(), name: "", description: "", lineItems: [newLineItem()], collapsed: false };
}

function phaseTotal(phase: TemplatePhase) {
  return phase.lineItems.reduce((sum, li) => sum + li.defaultQuantity * li.defaultPrice, 0);
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

  // Phase helpers
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

  // Line item helpers
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
    field: keyof Omit<TemplateLineItem, "_key">,
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

  const estimatedTotal = phases.reduce((sum, p) => sum + phaseTotal(p), 0);

  const fmt = (n: number) =>
    n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
      const url =
        mode === "create" ? "/api/templates" : `/api/templates/${initialData?.id}`;
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
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Template Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard UX Research Study"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What type of projects is this template for?"
              rows={2}
            />
          </div>

          <div className="space-y-2 w-48">
            <Label>Pricing Model</Label>
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
        </CardContent>
      </Card>

      {/* Phases */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Phases & Default Items</h2>
          <Button type="button" variant="outline" size="sm" onClick={addPhase}>
            <Plus className="h-4 w-4 mr-2" />
            Add Phase
          </Button>
        </div>

        {phases.map((phase, phaseIdx) => (
          <Card key={phase._key}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
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
                  <span className="text-sm font-medium text-gray-600 mr-2">
                    ${fmt(phaseTotal(phase))}
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
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
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

                <div className="grid grid-cols-12 gap-2 mb-2 px-1">
                  <div className="col-span-4 text-xs font-medium text-gray-500">Description</div>
                  <div className="col-span-2 text-xs font-medium text-gray-500">Unit</div>
                  <div className="col-span-2 text-xs font-medium text-gray-500">Default Qty</div>
                  <div className="col-span-2 text-xs font-medium text-gray-500">Default Price</div>
                  <div className="col-span-1 text-xs font-medium text-gray-500 text-right">Total</div>
                  <div className="col-span-1" />
                </div>

                <div className="space-y-2">
                  {phase.lineItems.map((item) => (
                    <div key={item._key} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <Input
                          value={item.description}
                          onChange={(e) =>
                            updateLineItem(phase._key, item._key, "description", e.target.value)
                          }
                          placeholder="Item description"
                          className="text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <Select
                          value={item.unit}
                          onValueChange={(v) =>
                            updateLineItem(phase._key, item._key, "unit", v)
                          }
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
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
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
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="text-sm"
                        />
                      </div>
                      <div className="col-span-2">
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
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="text-sm"
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        <span className="text-sm font-medium text-gray-700">
                          {fmt(item.defaultQuantity * item.defaultPrice)}
                        </span>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLineItem(phase._key, item._key)}
                          className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                          disabled={phase.lineItems.length === 1}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-3 text-gray-500"
                  onClick={() => addLineItem(phase._key)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add item
                </Button>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Estimated total */}
      <Card>
        <CardContent className="pt-6">
          <div className="max-w-xs ml-auto">
            <div className="flex justify-between">
              <span className="font-semibold text-gray-700">Estimated Default Total</span>
              <span className="font-bold text-lg">${fmt(estimatedTotal)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

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
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {mode === "create" ? "Create Template" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
