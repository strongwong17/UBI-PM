"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
import {
  Loader2,
  Plus,
  CheckCircle2,
  Clock,
  Copy,
  Send,
} from "lucide-react";

interface ScopeVersion {
  id: string;
  content: string;
  version: number;
  createdAt: string;
  confirmed: boolean;
  confirmedAt: string | null;
  confirmedByName: string | null;
  confirmToken: string | null;
  createdBy: { name: string } | null;
}

interface ScopeVersionHistoryProps {
  projectId: string;
}

export function ScopeVersionHistory({ projectId }: ScopeVersionHistoryProps) {
  const router = useRouter();
  const [versions, setVersions] = useState<ScopeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [newContent, setNewContent] = useState("");

  useEffect(() => {
    fetch(`/api/projects/${projectId}/scope-versions`)
      .then((res) => res.json())
      .then(setVersions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  async function handleCreate() {
    if (!newContent.trim() || newContent === "<p></p>") {
      toast.error("Content is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/scope-versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const version = await res.json();
      setVersions((prev) => [version, ...prev]);
      setNewContent("");
      setShowEditor(false);
      toast.success(`Version ${version.version} created`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  function copyConfirmLink(token: string) {
    const url = `${window.location.origin}/confirm/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Confirmation link copied");
  }

  function timeAgo(date: string) {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 30) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Scope of work</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowEditor(!showEditor)}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New version
        </Button>
      </div>

      {/* New version editor */}
      {showEditor && (
        <Card className="border-blue-200">
          <CardContent className="py-4 space-y-3">
            <p className="text-xs text-gray-500">
              Version {versions.length + 1} — describe the current scope of work
            </p>
            <RichTextEditor
              content={newContent}
              onChange={setNewContent}
              placeholder="Describe the scope of work..."
            />
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setShowEditor(false); setNewContent(""); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={saving}>
                {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Save version
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Version history */}
      {versions.length === 0 && !showEditor ? (
        <p className="text-sm text-gray-400 text-center py-4">
          No scope versions yet. Create one to track changes and send for confirmation.
        </p>
      ) : (
        <div className="space-y-2">
          {versions.map((v) => (
            <Card key={v.id} className={v.confirmed ? "border-green-200 bg-green-50/30" : ""}>
              <CardContent className="py-3">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[11px]">v{v.version}</Badge>
                    <span className="text-xs text-gray-400">
                      {v.createdBy?.name || "System"} · {timeAgo(v.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {v.confirmed ? (
                      <div className="flex items-center gap-1 text-xs text-green-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Confirmed by {v.confirmedByName}
                      </div>
                    ) : (
                      <>
                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                        {v.confirmToken && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-gray-500 hover:text-gray-700"
                            onClick={() => copyConfirmLink(v.confirmToken!)}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copy link
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div
                  className="text-sm text-gray-700 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(v.content) }}
                />

                {/* Confirmation timestamp */}
                {v.confirmed && v.confirmedAt && (
                  <p className="text-[11px] text-gray-400 mt-2">
                    Confirmed {new Date(v.confirmedAt).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
