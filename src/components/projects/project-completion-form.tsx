"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface ProjectCompletionFormProps {
  projectId: string;
  initialData?: {
    internalCompleted?: boolean;
    internalCompletedAt?: string | null;
    internalNotes?: string | null;
    clientAcknowledged?: boolean;
    clientAcknowledgedAt?: string | null;
    clientAcknowledgedBy?: string | null;
    clientAcknowledgeNotes?: string | null;
    deliverablesNotes?: string | null;
    internalCompletedBy?: { name: string } | null;
  } | null;
}

export function ProjectCompletionForm({ projectId, initialData }: ProjectCompletionFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    internalCompleted: initialData?.internalCompleted ?? false,
    internalNotes: initialData?.internalNotes ?? "",
    clientAcknowledged: initialData?.clientAcknowledged ?? false,
    clientAcknowledgedBy: initialData?.clientAcknowledgedBy ?? "",
    clientAcknowledgeNotes: initialData?.clientAcknowledgeNotes ?? "",
    deliverablesNotes: initialData?.deliverablesNotes ?? "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/completion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      toast.success("Completion status saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Internal Sign-off */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Internal Sign-off</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              id="internalCompleted"
              checked={form.internalCompleted}
              onCheckedChange={(v) => setForm((prev) => ({ ...prev, internalCompleted: !!v }))}
            />
            <Label htmlFor="internalCompleted" className="font-medium cursor-pointer">
              Internal work completed
            </Label>
          </div>
          {initialData?.internalCompletedAt && (
            <p className="text-sm text-gray-500">
              Completed at: {new Date(initialData.internalCompletedAt).toLocaleString()}
              {initialData.internalCompletedBy && ` by ${initialData.internalCompletedBy.name}`}
            </p>
          )}
          <div className="space-y-2">
            <Label>Internal Notes</Label>
            <Textarea
              value={form.internalNotes}
              onChange={(e) => setForm((prev) => ({ ...prev, internalNotes: e.target.value }))}
              placeholder="Notes for internal team..."
              rows={3}
              className="resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Client Sign-off */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client Acknowledgement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              id="clientAcknowledged"
              checked={form.clientAcknowledged}
              onCheckedChange={(v) => setForm((prev) => ({ ...prev, clientAcknowledged: !!v }))}
            />
            <Label htmlFor="clientAcknowledged" className="font-medium cursor-pointer">
              Client has acknowledged completion
            </Label>
          </div>
          {initialData?.clientAcknowledgedAt && (
            <p className="text-sm text-gray-500">
              Acknowledged at: {new Date(initialData.clientAcknowledgedAt).toLocaleString()}
            </p>
          )}
          <div className="space-y-2">
            <Label>Acknowledged By (Client)</Label>
            <Input
              value={form.clientAcknowledgedBy}
              onChange={(e) => setForm((prev) => ({ ...prev, clientAcknowledgedBy: e.target.value }))}
              placeholder="Contact name"
            />
          </div>
          <div className="space-y-2">
            <Label>Client Notes</Label>
            <Textarea
              value={form.clientAcknowledgeNotes}
              onChange={(e) => setForm((prev) => ({ ...prev, clientAcknowledgeNotes: e.target.value }))}
              placeholder="Client feedback or notes..."
              rows={3}
              className="resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Deliverables */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deliverables Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.deliverablesNotes}
            onChange={(e) => setForm((prev) => ({ ...prev, deliverablesNotes: e.target.value }))}
            placeholder="Notes about deliverables provided to client..."
            rows={4}
            className="resize-none"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Completion
        </Button>
      </div>
    </form>
  );
}
