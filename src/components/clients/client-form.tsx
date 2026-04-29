"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Star, Loader2 } from "lucide-react";

interface ContactInput {
  id?: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  isPrimary: boolean;
}

interface ClientFormData {
  company: string;
  shortName: string;
  industry: string;
  notes: string;
  billingAddress: string;
  taxId: string;
  email: string;
  phone: string;
  wechatId: string;
  billingName: string;
  billingEmail: string;
  billingPhone: string;
}

interface ClientFormProps {
  initialData?: ClientFormData & { id: string };
  initialContacts?: ContactInput[];
  mode: "create" | "edit";
}

export function ClientForm({ initialData, initialContacts = [], mode }: ClientFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<ClientFormData>({
    company: initialData?.company || "",
    shortName: initialData?.shortName || "",
    industry: initialData?.industry || "",
    notes: initialData?.notes || "",
    billingAddress: initialData?.billingAddress || "",
    taxId: initialData?.taxId || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    wechatId: initialData?.wechatId || "",
    billingName: initialData?.billingName || "",
    billingEmail: initialData?.billingEmail || "",
    billingPhone: initialData?.billingPhone || "",
  });

  const [contacts, setContacts] = useState<ContactInput[]>(initialContacts);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function addContact() {
    setContacts((prev) => [
      ...prev,
      { name: "", email: "", phone: "", title: "", isPrimary: false },
    ]);
  }

  function removeContact(index: number) {
    setContacts((prev) => prev.filter((_, i) => i !== index));
  }

  function updateContact(index: number, field: keyof ContactInput, value: string | boolean) {
    setContacts((prev) =>
      prev.map((contact, i) => {
        if (i !== index) {
          if (field === "isPrimary" && value === true) return { ...contact, isPrimary: false };
          return contact;
        }
        return { ...contact, [field]: value };
      })
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.company.trim()) {
      toast.error("Company name is required");
      return;
    }
    for (const contact of contacts) {
      if (!contact.name.trim()) {
        toast.error("All contacts must have a name");
        return;
      }
    }
    setIsSubmitting(true);
    try {
      if (mode === "create") {
        const res = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...formData, contacts }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create client");
        }
        const client = await res.json();
        toast.success("Client created successfully");
        router.push(`/clients/${client.id}`);
      } else if (initialData?.id) {
        const res = await fetch(`/api/clients/${initialData.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update client");
        }
        const existingContactIds = initialContacts.filter((c) => c.id).map((c) => c.id);
        const currentContactIds = contacts.filter((c) => c.id).map((c) => c.id);
        for (const cid of existingContactIds) {
          if (!currentContactIds.includes(cid)) {
            await fetch(`/api/clients/${initialData.id}/contacts/${cid}`, { method: "DELETE" });
          }
        }
        for (const contact of contacts) {
          if (contact.id) {
            await fetch(`/api/clients/${initialData.id}/contacts/${contact.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(contact),
            });
          } else {
            await fetch(`/api/clients/${initialData.id}/contacts`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(contact),
            });
          }
        }
        toast.success("Client updated successfully");
        router.push(`/clients/${initialData.id}`);
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Company */}
      <div>
        <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
          {"// COMPANY"}
        </p>
        <div
          className="bg-card-rd rounded-[14px] p-5 space-y-4"
          style={{
            border: "1px solid var(--color-hairline)",
            boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
                {"// COMPANY NAME *"}
              </label>
              <Input
                name="company"
                value={formData.company}
                onChange={handleChange}
                placeholder="Company / Organisation name"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
                {"// SHORT NAME"}
              </label>
              <Input
                name="shortName"
                value={formData.shortName}
                onChange={handleChange}
                placeholder="ACME"
                className="uppercase"
              />
              <p className="text-[11px] text-ink-400 font-mono tracking-[0.02em]">
                {"// used in EST/INV numbers"}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
              {"// INDUSTRY"}
            </label>
            <Input
              name="industry"
              value={formData.industry}
              onChange={handleChange}
              placeholder="e.g. FMCG, Automotive"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
              {"// ADDRESS"}
            </label>
            <Textarea
              name="billingAddress"
              value={formData.billingAddress}
              onChange={handleChange}
              placeholder="Company address"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
              {"// TAX ID / BUSINESS REG. NO."}
            </label>
            <Input
              name="taxId"
              value={formData.taxId}
              onChange={handleChange}
              placeholder="e.g. 统一社会信用代码"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
              {"// NOTES"}
            </label>
            <Textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Contacts */}
      <div>
        <div
          className="flex items-center justify-between gap-3 pb-3 mb-3"
          style={{ borderBottom: "1px solid var(--color-hairline)" }}
        >
          <div>
            <h2 className="text-[20px] font-bold tracking-[-0.02em] m-0 text-ink-900">
              Contacts
            </h2>
            <p className="text-[12px] text-ink-500 m-0">
              {contacts.length} {contacts.length === 1 ? "contact" : "contacts"} · star one as
              primary
            </p>
          </div>
          <button
            type="button"
            onClick={addContact}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd"
            style={{
              background: "var(--color-canvas-cool)",
              border: "1px solid var(--color-hairline-strong)",
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Add contact
          </button>
        </div>

        {contacts.length === 0 ? (
          <div
            className="bg-card-rd rounded-[14px] p-8 text-center"
            style={{
              border: "1px solid var(--color-hairline)",
              boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
            }}
          >
            <p className="text-[13px] text-ink-500">
              No contacts yet. Add one to assign to projects.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact, index) => (
              <div
                key={index}
                className="bg-card-rd rounded-[14px] p-5"
                style={{
                  border: contact.isPrimary
                    ? "1px solid var(--color-accent-rd)"
                    : "1px solid var(--color-hairline)",
                  boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
                }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
                        {`// CONTACT ${index + 1}`}
                      </span>
                      {contact.isPrimary && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-[0.06em] uppercase"
                          style={{
                            background: "var(--color-canvas-cool)",
                            color: "var(--color-accent-rd)",
                            border: "1px solid var(--color-accent-rd)",
                          }}
                        >
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400">
                          {"// NAME *"}
                        </label>
                        <Input
                          value={contact.name}
                          onChange={(e) => updateContact(index, "name", e.target.value)}
                          placeholder="Contact name"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400">
                          {"// TITLE"}
                        </label>
                        <Input
                          value={contact.title}
                          onChange={(e) => updateContact(index, "title", e.target.value)}
                          placeholder="e.g. Research Manager"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400">
                          {"// EMAIL"}
                        </label>
                        <Input
                          type="email"
                          value={contact.email}
                          onChange={(e) => updateContact(index, "email", e.target.value)}
                          placeholder="contact@example.com"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400">
                          {"// PHONE"}
                        </label>
                        <Input
                          value={contact.phone}
                          onChange={(e) => updateContact(index, "phone", e.target.value)}
                          placeholder="+86 ..."
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 pt-5">
                    <button
                      type="button"
                      onClick={() => updateContact(index, "isPrimary", !contact.isPrimary)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[#FCFAF6]"
                      style={{
                        color: contact.isPrimary ? "var(--color-accent-rd)" : "var(--color-ink-300)",
                      }}
                      aria-label={contact.isPrimary ? "Unset as primary" : "Set as primary"}
                      title={contact.isPrimary ? "Unset as primary" : "Set as primary"}
                    >
                      <Star
                        className="h-4 w-4"
                        fill={contact.isPrimary ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeContact(index)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-ink-300 hover:text-warn-fg hover:bg-warn-bg"
                      aria-label="Remove contact"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
          <strong className="text-ink-900 font-bold">{contacts.length}</strong>{" "}
          {contacts.length === 1 ? "contact" : "contacts"}
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
            {mode === "create" ? "Create client" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
