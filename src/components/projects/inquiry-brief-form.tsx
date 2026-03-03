"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Clock } from "lucide-react";

type ServiceModuleType =
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
  SIMULTANEOUS_TRANSLATION: "Translation",
  PROJECT_MANAGEMENT: "Project Mgmt",
  INCENTIVES: "Incentives",
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

interface InquiryBriefFormProps {
  projectId: string;
  initialData?: {
    createdAt?: string | null;
    rawContent?: string | null;
    source?: string;
    sourceDetail?: string | null;
    desiredStartDate?: string | null;
    desiredEndDate?: string | null;
    timeline?: string | null;
    serviceModules?: { moduleType: string; sortOrder: number }[];
  } | null;
}

export function InquiryBriefForm({ projectId, initialData }: InquiryBriefFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    rawContent: initialData?.rawContent || "",
    source: initialData?.source || "OTHER",
    sourceDetail: initialData?.sourceDetail || "",
    desiredStartDate: initialData?.desiredStartDate
      ? new Date(initialData.desiredStartDate).toISOString().split("T")[0]
      : "",
    desiredEndDate: initialData?.desiredEndDate
      ? new Date(initialData.desiredEndDate).toISOString().split("T")[0]
      : "",
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        rawContent: form.rawContent || null,
        source: form.source,
        sourceDetail: form.sourceDetail || null,
        desiredStartDate: form.desiredStartDate || null,
        desiredEndDate: form.desiredEndDate || null,
        timeline: form.timeline || null,
        serviceModules: ALL_MODULES.filter((t) => selectedModules.has(t)).map(
          (moduleType, i) => ({ moduleType, sortOrder: i })
        ),
      };

      const res = await fetch(`/api/projects/${projectId}/inquiry`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      toast.success("Brief saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-500">Client Brief</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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

          {/* Client message */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Client Message</Label>
            <Textarea
              name="rawContent"
              value={form.rawContent}
              onChange={handleChange}
              placeholder="Paste the original client message here..."
              rows={4}
              className="resize-none text-sm"
            />
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

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Target Start</Label>
              <Input
                name="desiredStartDate"
                type="date"
                value={form.desiredStartDate}
                onChange={handleChange}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Target End</Label>
              <Input
                name="desiredEndDate"
                type="date"
                value={form.desiredEndDate}
                onChange={handleChange}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Notes</Label>
            <Textarea
              name="timeline"
              value={form.timeline}
              onChange={handleChange}
              placeholder="Other requirements, constraints, or context..."
              rows={2}
              className="resize-none text-sm"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Brief
        </Button>
      </div>
    </form>
  );
}
