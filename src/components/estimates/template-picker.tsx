"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Layers, CheckCircle2 } from "lucide-react";

interface TemplateLineItem {
  description: string;
  unit: string;
  defaultQuantity: number;
  defaultPrice: number;
  sortOrder: number;
}

interface TemplatePhase {
  name: string;
  description: string | null;
  sortOrder: number;
  lineItems: TemplateLineItem[];
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  pricingModel: string;
  phases: TemplatePhase[];
  _count: { phases: number };
}

interface TemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: Template) => void;
}

export function TemplatePicker({ open, onOpenChange, onSelect }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTemplates(data);
      })
      .catch(() => toast.error("Failed to load templates"))
      .finally(() => setIsLoading(false));
  }, [open]);

  async function handleSelect(template: Template) {
    // Fetch full template data (with phases and line items)
    setSelectedId(template.id);
    try {
      const res = await fetch(`/api/templates/${template.id}`);
      if (!res.ok) throw new Error("Failed to load template");
      const full = await res.json();
      onSelect(full);
      onOpenChange(false);
    } catch {
      toast.error("Failed to load template details");
    } finally {
      setSelectedId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose a Template</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12">
            <Layers className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No templates available.</p>
            <p className="text-xs text-gray-400 mt-1">
              Create templates from the Templates section in Admin settings.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => handleSelect(template)}
                disabled={selectedId === template.id}
                className="w-full text-left p-4 rounded-lg border hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-gray-900 truncate">{template.name}</p>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {template.pricingModel}
                      </Badge>
                    </div>
                    {template.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {template.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {template._count.phases} phase{template._count.phases !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {selectedId === template.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-gray-300 shrink-0 mt-0.5" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
