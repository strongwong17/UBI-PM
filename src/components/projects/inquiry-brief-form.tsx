"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Clock } from "lucide-react";


type ServiceModuleType =
  | "FULL_SERVICE"
  | "RECRUITMENT"
  | "RECRUITMENT_MODERATION"
  | "MODERATION"
  | "INCENTIVES";

const MODULE_LABELS: Record<ServiceModuleType, string> = {
  FULL_SERVICE: "Full service",
  RECRUITMENT: "Recruitment only",
  RECRUITMENT_MODERATION: "Recruitment + Moderation",
  MODERATION: "Moderation only",
  INCENTIVES: "Incentives",
};

const ALL_MODULES: ServiceModuleType[] = [
  "FULL_SERVICE",
  "RECRUITMENT",
  "RECRUITMENT_MODERATION",
  "MODERATION",
  "INCENTIVES",
];

interface InquiryBriefFormProps {
  projectId: string;
  initialData?: {
    createdAt?: string | null;
    source?: string;
    sourceDetail?: string | null;
    durationWeeks?: string;
    timeline?: string | null;
    serviceModules?: { moduleType: string; sortOrder: number }[];
  } | null;
}

export function InquiryBriefForm({ projectId, initialData }: InquiryBriefFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    source: initialData?.source || "OTHER",
    sourceDetail: initialData?.sourceDetail || "",
    durationWeeks: initialData?.durationWeeks || "",
    timeline: initialData?.timeline || "",
  });

  const [selectedModules, setSelectedModules] = useState<Set<ServiceModuleType>>(
    new Set(
      (initialData?.serviceModules || []).map((m) => m.moduleType as ServiceModuleType)
    )
  );

  function toggleModule(type: ServiceModuleType) {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // Auto-save with debounce
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  const doSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        source: form.source,
        sourceDetail: form.sourceDetail || null,
        scope: form.durationWeeks ? `${form.durationWeeks} weeks` : null,
        serviceModules: ALL_MODULES.filter((t) => selectedModules.has(t)).map(
          (moduleType, i) => ({ moduleType, sortOrder: i })
        ),
      };
      await fetch(`/api/projects/${projectId}/inquiry`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // silent fail on auto-save
    } finally {
      setSaving(false);
    }
  }, [form, selectedModules, projectId]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(doSave, 1000);
    return () => { if (saveTimeout.current) clearTimeout(saveTimeout.current); };
  }, [form, selectedModules, doSave]);

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {/* Inquiry received timestamp */}
        {initialData?.createdAt && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Clock className="h-3 w-3" />
            Inquiry received {new Date(initialData.createdAt).toLocaleString()}
          </div>
        )}

          {/* Point of contact */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Channel</Label>
              <Select
                value={form.source}
                onValueChange={(v) => setForm((prev) => ({ ...prev, source: v }))}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WECHAT">WeChat</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="LARK">Lark</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Point of Contact</Label>
              <Input
                name="sourceDetail"
                value={form.sourceDetail}
                onChange={handleChange}
                placeholder="Name / contact detail"
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Service tags */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Services</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_MODULES.map((type) => {
                const active = selectedModules.has(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleModule(type)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600"
                    }`}
                  >
                    {MODULE_LABELS[type]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Estimated duration</Label>
            <div className="flex items-center gap-2">
              <Input
                name="durationWeeks"
                type="number"
                min={1}
                value={form.durationWeeks}
                onChange={handleChange}
                placeholder="e.g. 4"
                className="h-8 text-sm w-24"
              />
              <span className="text-sm text-gray-500">weeks</span>
            </div>
          </div>

      </div>
      {saving && <p className="text-[11px] text-gray-400">Saving...</p>}
    </div>
  );
}
