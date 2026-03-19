"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Plus,
  MessageCircle,
  MoreHorizontal,
  Clock,
  Users,
  Loader2,
  Check,
  Paperclip,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { ProjectAttachments } from "@/components/projects/project-attachments";
import { RichTextEditor } from "@/components/shared/rich-text-editor";

// ─── Types ───────────────────────────────────────

interface Signal {
  id: string;
  title: string;
  content: string;
  source: string;
  contactName: string | null;
  tags: string | null;
  notes: string | null;
  createdAt: string;
}

interface ActionItemData {
  id: string;
  title: string;
  tag: string | null;
  completed: boolean;
  category: string;
  clientSignalId: string | null;
}

const TAG_COLORS: Record<string, string> = {
  Estimate: "bg-blue-50 text-blue-700 border-blue-200",
  Scope: "bg-green-50 text-green-700 border-green-200",
  Budget: "bg-amber-50 text-amber-700 border-amber-200",
  Timeline: "bg-purple-50 text-purple-700 border-purple-200",
  Research: "bg-teal-50 text-teal-700 border-teal-200",
  Incentive: "bg-orange-50 text-orange-700 border-orange-200",
  Costs: "bg-red-50 text-red-700 border-red-200",
};

function TagChip({ tag }: { tag: string }) {
  const color = TAG_COLORS[tag] || "bg-gray-50 text-gray-600 border-gray-200";
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-md border", color)}>
      {tag}
    </span>
  );
}

function timeAgo(date: string): string {
  const d = new Date(date);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  return d.toLocaleDateString();
}

// ─── Main Component ──────────────────────────────

interface AttachmentItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface ClientSignalsPanelProps {
  projectId: string;
  attachments?: AttachmentItem[];
  briefForm?: React.ReactNode;
}

export function ClientSignalsPanel({ projectId, attachments = [], briefForm }: ClientSignalsPanelProps) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [actionItems, setActionItems] = useState<ActionItemData[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [showAddSignal, setShowAddSignal] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  // Signal form
  const [newSignal, setNewSignal] = useState({ title: "", content: "", contactName: "", tags: "", source: "WECHAT" });
  // Task form
  const [newTask, setNewTask] = useState({ title: "", tag: "" });
  // Editing task
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState("");
  // Signal notes
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/signals`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/action-items`).then((r) => r.json()),
    ])
      .then(([s, a]) => {
        setSignals(Array.isArray(s) ? s : []);
        setActionItems(Array.isArray(a) ? a : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  // ── Signal actions ──

  async function handleAddSignal() {
    if (!newSignal.title.trim() || !newSignal.content.trim()) return;
    setSaving("signal");
    try {
      const res = await fetch(`/api/projects/${projectId}/signals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSignal),
      });
      if (!res.ok) throw new Error();
      const signal = await res.json();
      setSignals((prev) => [...prev, signal]);
      setNewSignal({ title: "", content: "", contactName: "", tags: "", source: "WECHAT" });
      setShowAddSignal(false);
      toast.success("Message added");
    } catch {
      toast.error("Failed to add message");
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveNote(signalId: string) {
    try {
      await fetch(`/api/projects/${projectId}/signals`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signalId, notes: editingNoteText }),
      });
      setSignals((prev) => prev.map((s) => s.id === signalId ? { ...s, notes: editingNoteText || null } : s));
      setEditingNoteId(null);
      toast.success("Note saved");
    } catch {
      toast.error("Failed to save note");
    }
  }

  async function handleCreateTasks(signalId: string, signal: Signal) {
    setSaving(`tasks-${signalId}`);
    const tags = signal.tags?.split(",").map((t) => t.trim()).filter(Boolean) || ["General"];
    const suggestedTasks = tags.map((tag) => {
      switch (tag) {
        case "Estimate": return { title: "Create estimate", tag: "Estimate" };
        case "Scope": return { title: "Clarify scope of study", tag: "Scope" };
        case "Budget": return { title: "Discuss budget constraints", tag: "Budget" };
        case "Timeline": return { title: "Confirm project timeline", tag: "Timeline" };
        case "Research": return { title: "Define research methodology", tag: "Research" };
        case "Incentive": return { title: "Confirm incentive distribution", tag: "Incentive" };
        default: return { title: `Follow up on: ${tag}`, tag };
      }
    });

    try {
      for (const task of suggestedTasks) {
        const res = await fetch(`/api/projects/${projectId}/action-items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...task, category: "TODO", clientSignalId: signalId }),
        });
        if (res.ok) {
          const item = await res.json();
          setActionItems((prev) => [...prev, item]);
        }
      }
      toast.success(`${suggestedTasks.length} tasks created`);
    } catch {
      toast.error("Failed to create tasks");
    } finally {
      setSaving(null);
    }
  }

  // ── Action item actions ──

  async function toggleAction(itemId: string, completed: boolean) {
    setActionItems((prev) => prev.map((a) => a.id === itemId ? { ...a, completed } : a));
    try {
      await fetch(`/api/projects/${projectId}/action-items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, completed }),
      });
    } catch {
      setActionItems((prev) => prev.map((a) => a.id === itemId ? { ...a, completed: !completed } : a));
    }
  }

  async function handleAddTask() {
    if (!newTask.title.trim()) return;
    setSaving("task");
    try {
      const res = await fetch(`/api/projects/${projectId}/action-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTask.title, tag: newTask.tag || null, category: "TODO" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed");
      }
      const item = await res.json();
      setActionItems((prev) => [...prev, item]);
      setNewTask({ title: "", tag: "" });
      setShowAddTask(false);
      toast.success("Task added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add task");
    } finally {
      setSaving(null);
    }
  }

  async function handleEditTask(itemId: string) {
    if (!editingTaskTitle.trim()) return;
    try {
      await fetch(`/api/projects/${projectId}/action-items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, title: editingTaskTitle.trim() }),
      });
      setActionItems((prev) => prev.map((a) => a.id === itemId ? { ...a, title: editingTaskTitle.trim() } : a));
      setEditingTaskId(null);
    } catch {
      toast.error("Failed to update task");
    }
  }

  async function handleDeleteTask(itemId: string) {
    setActionItems((prev) => prev.filter((a) => a.id !== itemId));
    try {
      await fetch(`/api/projects/${projectId}/action-items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, deleted: true }),
      });
    } catch {
      toast.error("Failed to delete task");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const todos = actionItems.filter((a) => a.category === "TODO");
  const followUps = actionItems.filter((a) => a.category === "FOLLOWUP");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      {/* ── LEFT: Client Brief ── */}
      <div className="lg:col-span-3">
        <div className="border border-gray-200 rounded-xl bg-white">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-[15px] font-semibold text-gray-900">Client Brief</h2>
            <button className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          {/* Brief form */}
          {briefForm && (
            <div className="px-5 py-4 border-b border-gray-100">
              {briefForm}
            </div>
          )}

          <div className="px-5 py-4 space-y-4">
            <h3 className="text-[13px] font-semibold text-gray-500">Messages</h3>
            {signals.length === 0 && !showAddSignal && (
              <p className="text-[13px] text-gray-400 text-center py-4">
                No client messages yet.
              </p>
            )}

            {signals.map((signal) => (
              <div key={signal.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="inline-block px-2.5 py-0.5 border border-gray-200 rounded-lg">
                  <span className="text-[13px] font-semibold text-gray-900">{signal.title}</span>
                </div>
                <div
                  className="text-[14px] text-gray-700 leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: signal.content }}
                />
                <div className="flex items-center gap-1.5 text-[12px] text-gray-400">
                  <MessageCircle className="h-3 w-3" />
                  <span>{signal.source === "WECHAT" ? "WeChat" : signal.source === "LARK" ? "Lark" : signal.source === "EMAIL" ? "Email" : "Other"}</span>
                  <span>·</span>
                  <span>{new Date(signal.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  <span>·</span>
                  <span>{new Date(signal.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                  {signal.contactName && (
                    <>
                      <span>·</span>
                      <span className="font-medium text-gray-500">{signal.contactName}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {signal.tags?.split(",").map((tag) => tag.trim()).filter(Boolean).map((tag) => (
                      <TagChip key={tag} tag={tag} />
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[12px] h-7 rounded-lg"
                    onClick={() => handleCreateTasks(signal.id, signal)}
                    disabled={saving === `tasks-${signal.id}`}
                  >
                    {saving === `tasks-${signal.id}` ? (
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    ) : null}
                    Create Tasks
                  </Button>
                </div>

                {/* Internal note on this message */}
                {editingNoteId === signal.id ? (
                  <div className="border-t border-gray-100 pt-2 mt-1 space-y-2">
                    <RichTextEditor
                      content={editingNoteText}
                      onChange={setEditingNoteText}
                      placeholder="Add internal note..."
                      className="text-[12px]"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => setEditingNoteId(null)}>Cancel</Button>
                      <Button size="sm" className="h-6 text-[11px]" onClick={() => handleSaveNote(signal.id)}>Save note</Button>
                    </div>
                  </div>
                ) : signal.notes ? (
                  <div
                    className="border-t border-gray-100 pt-2 mt-1 cursor-pointer group/note"
                    onClick={() => { setEditingNoteId(signal.id); setEditingNoteText(signal.notes || ""); }}
                  >
                    <div className="flex items-start gap-2">
                      <div className="h-4 w-4 rounded bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[9px]">📝</span>
                      </div>
                      <div
                        className="text-[12px] text-gray-600 group-hover/note:text-gray-900 transition-colors prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: signal.notes }}
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingNoteId(signal.id); setEditingNoteText(""); }}
                    className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors mt-1"
                  >
                    + Add note
                  </button>
                )}
              </div>
            ))}

            {/* Add message form — rich text */}
            {showAddSignal && (
              <div className="border border-blue-200 rounded-xl p-4 space-y-3 bg-blue-50/30">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[12px]">Title</Label>
                    <Input
                      value={newSignal.title}
                      onChange={(e) => setNewSignal((p) => ({ ...p, title: e.target.value }))}
                      placeholder="e.g. Client Request"
                      className="h-8 text-[13px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[12px]">Contact name</Label>
                    <Input
                      value={newSignal.contactName}
                      onChange={(e) => setNewSignal((p) => ({ ...p, contactName: e.target.value }))}
                      placeholder="e.g. Alan Wang"
                      className="h-8 text-[13px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[12px]">Source</Label>
                    <div className="flex gap-1">
                      {["WECHAT", "EMAIL", "LARK", "OTHER"].map((src) => (
                        <button
                          key={src}
                          type="button"
                          onClick={() => setNewSignal((p) => ({ ...p, source: src }))}
                          className={cn(
                            "px-2 py-1 rounded-md text-[11px] font-medium border transition-colors",
                            newSignal.source === src
                              ? "bg-gray-900 text-white border-gray-900"
                              : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                          )}
                        >
                          {src === "WECHAT" ? "WeChat" : src === "EMAIL" ? "Email" : src === "LARK" ? "Lark" : "Other"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[12px]">Message</Label>
                  <RichTextEditor
                    content={newSignal.content}
                    onChange={(html) => setNewSignal((p) => ({ ...p, content: html }))}
                    placeholder="Paste or summarize the client message..."
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[12px]">Tags (comma separated)</Label>
                  <Input
                    value={newSignal.tags}
                    onChange={(e) => setNewSignal((p) => ({ ...p, tags: e.target.value }))}
                    placeholder="Estimate, Scope, Budget"
                    className="h-8 text-[13px]"
                  />
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Button variant="ghost" size="sm" className="h-7 text-[12px]" onClick={() => setShowAddSignal(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" className="h-7 text-[12px]" onClick={handleAddSignal} disabled={saving === "signal"}>
                    {saving === "signal" && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                    Add Message
                  </Button>
                </div>
              </div>
            )}

            {!showAddSignal && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[12px] h-7 rounded-lg"
                  onClick={() => setShowAddSignal(true)}
                >
                  <Plus className="h-3 w-3 mr-1.5" />
                  Add Message
                </Button>
              </div>
            )}

            {/* Attachments */}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center gap-1.5 mb-2">
                <Paperclip className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-[13px] font-medium text-gray-600">
                  Attachments{attachments.length > 0 ? ` (${attachments.length})` : ""}
                </span>
              </div>
              <ProjectAttachments projectId={projectId} attachments={attachments} />
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Action Items ── */}
      <div className="lg:col-span-2">
        <div className="border border-gray-200 rounded-xl bg-white">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-[15px] font-semibold text-gray-900">Action Items</h2>
          </div>

          <div className="px-5 py-4 space-y-5">
            {/* To-Do */}
            <div>
              <h3 className="text-[14px] font-semibold text-gray-900 mb-2">To-Do</h3>
              {todos.length === 0 && !showAddTask && (
                <p className="text-[12px] text-gray-400 mb-2">No tasks yet</p>
              )}
              <div className="space-y-0.5">
                {todos.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-1.5 group rounded-md hover:bg-gray-50 px-1 -mx-1"
                  >
                    {editingTaskId === item.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editingTaskTitle}
                          onChange={(e) => setEditingTaskTitle(e.target.value)}
                          className="h-7 text-[12px] flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleEditTask(item.id);
                            if (e.key === "Escape") setEditingTaskId(null);
                          }}
                          autoFocus
                        />
                        <button onClick={() => handleEditTask(item.id)} className="text-green-600 hover:text-green-700">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setEditingTaskId(null)} className="text-gray-400 hover:text-gray-600">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Checkbox
                            checked={item.completed}
                            onCheckedChange={(v) => toggleAction(item.id, !!v)}
                          />
                          <span className={cn(
                            "text-[13px]",
                            item.completed ? "line-through text-gray-400" : "text-gray-800"
                          )}>
                            {item.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {item.tag && <TagChip tag={item.tag} />}
                          <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                            <button
                              onClick={() => { setEditingTaskId(item.id); setEditingTaskTitle(item.title); }}
                              className="h-6 w-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteTask(item.id)}
                              className="h-6 w-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {showAddTask ? (
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    value={newTask.title}
                    onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
                    placeholder="New task..."
                    className="h-7 text-[12px] flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                    autoFocus
                  />
                  <Button size="sm" className="h-7 text-[11px]" onClick={handleAddTask} disabled={saving === "task"}>
                    Add
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setShowAddTask(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddTask(true)}
                  className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-600 mt-2 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Add Task
                </button>
              )}
            </div>

            {/* Follow-Ups */}
            <div>
              <h3 className="text-[14px] font-semibold text-gray-900 mb-2">Follow-Ups</h3>
              {followUps.length === 0 && (
                <p className="text-[12px] text-gray-400">No follow-ups</p>
              )}
              <div className="space-y-0.5">
                {followUps.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-1.5 group rounded-md hover:bg-gray-50 px-1 -mx-1">
                    <div className="flex items-center gap-2 min-w-0">
                      {item.completed ? (
                        <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      ) : item.tag === "client" ? (
                        <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      ) : (
                        <Users className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      )}
                      <span className={cn(
                        "text-[13px]",
                        item.completed ? "line-through text-gray-400" : "text-gray-700"
                      )}>
                        {item.title}
                      </span>
                    </div>
                    <div className="hidden group-hover:flex items-center gap-0.5">
                      <button
                        onClick={() => handleDeleteTask(item.id)}
                        className="h-6 w-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
