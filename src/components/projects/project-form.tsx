"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface Client {
  id: string;
  company: string;
  contacts: { id: string; name: string; isPrimary: boolean }[];
}

interface User {
  id: string;
  name: string;
}

interface ProjectFormProps {
  users: User[];
}

export function ProjectForm({ users }: ProjectFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);

  const [clientId, setClientId] = useState("");
  const [primaryContactId, setPrimaryContactId] = useState("");
  const [title, setTitle] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [notes, setNotes] = useState("");

  const selectedClient = clients.find((c) => c.id === clientId);

  useEffect(() => {
    async function fetchClients() {
      try {
        const res = await fetch("/api/clients");
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (res.ok) {
          const data = await res.json();
          const clientsWithContacts = await Promise.all(
            data.map(async (client: { id: string; company: string }) => {
              const cRes = await fetch(`/api/clients/${client.id}`);
              if (cRes.ok) {
                const cd = await cRes.json();
                return cd;
              }
              return { ...client, contacts: [] };
            })
          );
          setClients(clientsWithContacts);
        }
      } catch {
        toast.error("Failed to load clients");
      }
    }
    fetchClients();
  }, []);

  useEffect(() => {
    setPrimaryContactId("");
  }, [clientId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) {
      toast.error("Please select a client");
      return;
    }
    if (!title.trim()) {
      toast.error("Project title is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          title: title.trim(),
          primaryContactId: primaryContactId || null,
          assignedToId: assignedToId || null,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create project");
      }

      const project = await res.json();
      toast.success("Project created");
      router.push(`/projects/${project.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create project");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Project details */}
      <div>
        <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
          {"// PROJECT DETAILS"}
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
              {"// CLIENT *"}
            </label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.company}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedClient && selectedClient.contacts.length > 0 && (
            <div className="space-y-1.5">
              <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
                {"// PRIMARY CONTACT"}
              </label>
              <Select value={primaryContactId} onValueChange={setPrimaryContactId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select contact (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {selectedClient.contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.isPrimary ? " (Primary)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
              {"// PROJECT TITLE *"}
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Skincare Usage Study Q2 2026"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
              {"// ASSIGN TO"}
            </label>
            <Select value={assignedToId} onValueChange={setAssignedToId}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member (optional)" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
              {"// NOTES"}
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Initial notes..."
              rows={3}
            />
          </div>
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
          {clientId ? (
            <>
              For{" "}
              <strong className="text-ink-900 font-bold">
                {clients.find((c) => c.id === clientId)?.company ?? ""}
              </strong>
            </>
          ) : (
            <span className="text-ink-400">Select a client to begin</span>
          )}
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
            Create project
          </button>
        </div>
      </div>
    </form>
  );
}
