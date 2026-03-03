"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ServiceModuleType =
  | "RECRUITMENT"
  | "MODERATION"
  | "SIMULTANEOUS_TRANSLATION"
  | "PROJECT_MANAGEMENT"
  | "INCENTIVES"
  | "VENUE"
  | "REPORTING"
  | "LOGISTICS";

const MODULE_LABELS: Record<ServiceModuleType, string> = {
  RECRUITMENT: "Recruitment",
  MODERATION: "Moderation",
  SIMULTANEOUS_TRANSLATION: "Simultaneous Translation",
  PROJECT_MANAGEMENT: "Project Management",
  INCENTIVES: "Incentives / Honorarium",
  VENUE: "Venue",
  REPORTING: "Reporting",
  LOGISTICS: "Logistics",
};

const ALL_MODULES: ServiceModuleType[] = [
  "RECRUITMENT",
  "MODERATION",
  "SIMULTANEOUS_TRANSLATION",
  "PROJECT_MANAGEMENT",
  "INCENTIVES",
  "VENUE",
  "REPORTING",
  "LOGISTICS",
];

export interface ServiceModuleInput {
  moduleType: ServiceModuleType;
  quantity: number | "";
  unit: string;
  unitPrice: number | "";
  notes: string;
  sortOrder: number;
}

interface ServiceModuleChecklistProps {
  value: ServiceModuleInput[];
  onChange: (modules: ServiceModuleInput[]) => void;
}

export function ServiceModuleChecklist({ value, onChange }: ServiceModuleChecklistProps) {
  const checkedTypes = new Set(value.map((m) => m.moduleType));

  function toggleModule(type: ServiceModuleType, checked: boolean) {
    if (checked) {
      const newModule: ServiceModuleInput = {
        moduleType: type,
        quantity: "",
        unit: "",
        unitPrice: "",
        notes: "",
        sortOrder: value.length,
      };
      onChange([...value, newModule]);
    } else {
      onChange(value.filter((m) => m.moduleType !== type));
    }
  }

  function updateModule(type: ServiceModuleType, field: keyof ServiceModuleInput, val: string | number) {
    onChange(value.map((m) => (m.moduleType === type ? { ...m, [field]: val } : m)));
  }

  return (
    <div className="space-y-3">
      {ALL_MODULES.map((type) => {
        const checked = checkedTypes.has(type);
        const module = value.find((m) => m.moduleType === type);

        return (
          <div key={type} className="border rounded-lg">
            <div className="flex items-center gap-3 p-3">
              <Checkbox
                id={`module-${type}`}
                checked={checked}
                onCheckedChange={(v) => toggleModule(type, !!v)}
              />
              <Label htmlFor={`module-${type}`} className="font-medium cursor-pointer">
                {MODULE_LABELS[type]}
              </Label>
            </div>
            {checked && module && (
              <div className="px-3 pb-3 pt-0 border-t grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Quantity</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="e.g. 12"
                    value={module.quantity}
                    onChange={(e) =>
                      updateModule(
                        type,
                        "quantity",
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Unit</Label>
                  <Input
                    placeholder="participants / days"
                    value={module.unit}
                    onChange={(e) => updateModule(type, "unit", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Unit Price</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0.00"
                    value={module.unitPrice}
                    onChange={(e) =>
                      updateModule(
                        type,
                        "unitPrice",
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                  />
                </div>
                <div className="space-y-1 col-span-2 md:col-span-4">
                  <Label className="text-xs text-gray-500">Notes</Label>
                  <Textarea
                    placeholder="Any specifics for this module..."
                    value={module.notes}
                    onChange={(e) => updateModule(type, "notes", e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
