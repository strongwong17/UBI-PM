"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, FolderOpen, Plus } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";

interface ProjectListItem {
  id: string;
  projectNumber: string;
  title: string;
  status: string;
  client: { company: string };
}

interface ClientListItem {
  id: string;
  company: string;
  contacts: { id: string; name: string; isPrimary: boolean }[];
}

interface ProjectPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPicked: (projectId: string) => void;
  onCancel?: () => void;
}

const monoLabel =
  "block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500 mb-1.5";

export function ProjectPickerDialog({
  open,
  onOpenChange,
  onPicked,
  onCancel,
}: ProjectPickerDialogProps) {
  const [tab, setTab] = useState<"existing" | "new">("existing");

  // Existing projects
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");

  // Create new project
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [newClientId, setNewClientId] = useState("");
  const [newPrimaryContactId, setNewPrimaryContactId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  // Lazy-load projects + clients on first open
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function load() {
      setProjectsLoading(true);
      setClientsLoading(true);
      try {
        const [projRes, clientRes] = await Promise.all([
          fetch("/api/projects"),
          fetch("/api/clients"),
        ]);

        if (projRes.status === 401 || clientRes.status === 401) {
          window.location.href = "/login";
          return;
        }

        if (projRes.ok) {
          const data = await projRes.json();
          if (!cancelled) setProjects(data);
        }

        if (clientRes.ok) {
          const baseClients: { id: string; company: string }[] = await clientRes.json();
          const withContacts = await Promise.all(
            baseClients.map(async (c) => {
              const r = await fetch(`/api/clients/${c.id}`);
              if (r.ok) return (await r.json()) as ClientListItem;
              return { ...c, contacts: [] } as ClientListItem;
            })
          );
          if (!cancelled) setClients(withContacts);
        }
      } catch {
        if (!cancelled) toast.error("Failed to load projects");
      } finally {
        if (!cancelled) {
          setProjectsLoading(false);
          setClientsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    setNewPrimaryContactId("");
  }, [newClientId]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) =>
      p.title.toLowerCase().includes(q) ||
      p.projectNumber.toLowerCase().includes(q) ||
      p.client.company.toLowerCase().includes(q)
    );
  }, [projects, search]);

  const selectedClient = clients.find((c) => c.id === newClientId);

  function handleClose(next: boolean) {
    if (!next && onCancel) onCancel();
    onOpenChange(next);
  }

  function confirmExisting() {
    if (!selectedProjectId) {
      toast.error("Select a project to continue");
      return;
    }
    onPicked(selectedProjectId);
  }

  async function confirmCreate() {
    if (!newClientId) {
      toast.error("Select a client");
      return;
    }
    if (!newTitle.trim()) {
      toast.error("Project title is required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: newClientId,
          title: newTitle.trim(),
          primaryContactId: newPrimaryContactId || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create project");
      }
      const project = await res.json();
      toast.success(`Created ${project.projectNumber}`);
      onPicked(project.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader
          className="px-6 pt-5 pb-4"
          style={{ borderBottom: "1px solid var(--color-hairline)" }}
        >
          <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-1.5">
            {"// NEW ESTIMATE"}
          </p>
          <DialogTitle className="text-[18px] font-bold tracking-[-0.02em] text-ink-900 m-0">
            Choose a project
          </DialogTitle>
          <DialogDescription className="text-[13px] text-ink-500 m-0">
            Every estimate belongs to a project. Pick an existing one or create a new project to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "existing" | "new")}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="existing" className="text-[12px] font-medium tracking-[-0.005em]">
                <FolderOpen className="h-3.5 w-3.5 mr-1.5" /> Existing project
              </TabsTrigger>
              <TabsTrigger value="new" className="text-[12px] font-medium tracking-[-0.005em]">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> New project
              </TabsTrigger>
            </TabsList>

            {/* ── EXISTING ───────────────────────────────────────── */}
            <TabsContent value="existing" className="space-y-3 pt-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-300 pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title, project number, or client"
                  className="pl-8 text-[13px]"
                />
              </div>

              <div
                className="max-h-[280px] overflow-y-auto rounded-[10px]"
                style={{
                  border: "1px solid var(--color-hairline)",
                  background: "var(--color-card-rd)",
                }}
              >
                {projectsLoading ? (
                  <div className="py-10 text-center text-[12px] text-ink-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin inline-block mr-1.5 align-[-2px]" />
                    Loading projects…
                  </div>
                ) : filteredProjects.length === 0 ? (
                  <div className="py-10 text-center text-[12px] text-ink-400">
                    {projects.length === 0
                      ? "No projects yet — switch to ‘New project’."
                      : "No projects match that search."}
                  </div>
                ) : (
                  <ul>
                    {filteredProjects.map((p, idx) => {
                      const active = p.id === selectedProjectId;
                      return (
                        <li
                          key={p.id}
                          style={{
                            borderTop:
                              idx === 0 ? "none" : "1px solid var(--color-hairline)",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedProjectId(p.id)}
                            className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 transition-colors hover:bg-[#FCFAF6]"
                            style={
                              active
                                ? {
                                    background: "var(--color-accent-soft)",
                                    boxShadow:
                                      "inset 2px 0 0 var(--color-accent-rd)",
                                  }
                                : undefined
                            }
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-[11px] text-ink-300 tracking-[0.04em] shrink-0">
                                  {p.projectNumber}
                                </span>
                                <span className="text-[13px] font-medium text-ink-900 truncate">
                                  {p.title}
                                </span>
                              </div>
                              <div className="text-[12px] text-ink-500 truncate mt-0.5">
                                {p.client.company}
                              </div>
                            </div>
                            <StatusBadge status={p.status} className="shrink-0" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </TabsContent>

            {/* ── NEW ───────────────────────────────────────────── */}
            <TabsContent value="new" className="space-y-4 pt-4">
              <div>
                <label className={monoLabel}>{"// CLIENT *"}</label>
                <Select value={newClientId} onValueChange={setNewClientId}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={clientsLoading ? "Loading…" : "Select client"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedClient && selectedClient.contacts.length > 0 && (
                <div>
                  <label className={monoLabel}>{"// PRIMARY CONTACT"}</label>
                  <Select value={newPrimaryContactId} onValueChange={setNewPrimaryContactId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select contact (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedClient.contacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                          {c.isPrimary ? " (Primary)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className={monoLabel}>{"// PROJECT TITLE *"}</label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Skincare Usage Study Q2 2026"
                  className="text-[13px]"
                />
              </div>

              <p className="text-[11px] text-ink-400 leading-relaxed">
                Project number is generated automatically. Brief, contacts, and dates can be added later from the project hub.
              </p>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-6 py-4"
          style={{
            borderTop: "1px solid var(--color-hairline)",
            background: "var(--color-canvas)",
          }}
        >
          <button
            type="button"
            onClick={() => handleClose(false)}
            disabled={creating}
            className="px-3 py-2 rounded-lg text-[13px] font-medium text-ink-700 hover:bg-[rgba(15,23,41,0.04)] disabled:opacity-50"
          >
            Cancel
          </button>
          {tab === "existing" ? (
            <button
              type="button"
              onClick={confirmExisting}
              disabled={!selectedProjectId}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white tracking-[-0.005em] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "var(--color-accent-rd)",
                boxShadow: "0 4px 12px -2px rgba(217, 82, 43, 0.32)",
              }}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={confirmCreate}
              disabled={creating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white tracking-[-0.005em] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "var(--color-accent-rd)",
                boxShadow: "0 4px 12px -2px rgba(217, 82, 43, 0.32)",
              }}
            >
              {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create &amp; continue
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
