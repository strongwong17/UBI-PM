"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Star, Loader2, ArrowLeft } from "lucide-react";

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
  // Keep these in the data model for backward compat but don't show in form
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
    // Preserve existing values but don't show in form
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
      <div className="flex items-center gap-4">
        <Button type="button" variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {mode === "create" ? "New Client" : "Edit Client"}
          </h1>
        </div>
      </div>

      {/* Company details */}
      <Card>
        <CardHeader><CardTitle>Company</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="company">Company name <span className="text-red-500">*</span></Label>
              <Input id="company" name="company" value={formData.company} onChange={handleChange} placeholder="Company / Organisation name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shortName">Short name</Label>
              <Input id="shortName" name="shortName" value={formData.shortName} onChange={handleChange} placeholder="e.g. ACME" className="uppercase" />
              <p className="text-xs text-gray-400">Used in estimate/invoice numbers</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Input id="industry" name="industry" value={formData.industry} onChange={handleChange} placeholder="e.g. FMCG, Automotive" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billingAddress">Address</Label>
            <Textarea id="billingAddress" name="billingAddress" value={formData.billingAddress} onChange={handleChange} placeholder="Company address" rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxId">Tax ID / Business registration no.</Label>
            <Input id="taxId" name="taxId" value={formData.taxId} onChange={handleChange} placeholder="e.g. 统一社会信用代码" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} placeholder="Additional notes..." rows={3} />
          </div>
        </CardContent>
      </Card>

      {/* Contacts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Contacts
            {contacts.length > 0 && <Badge variant="secondary">{contacts.length}</Badge>}
          </CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addContact}>
            <Plus className="h-4 w-4 mr-2" />Add Contact
          </Button>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No contacts yet. Add a contact to assign to projects.</p>
          ) : (
            <div className="space-y-4">
              {contacts.map((contact, index) => (
                <div key={index}>
                  {index > 0 && <Separator className="mb-4" />}
                  <div className="flex items-start gap-4">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-700">Contact {index + 1}</span>
                        {contact.isPrimary && <Badge variant="default" className="text-xs">Primary</Badge>}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Name <span className="text-red-500">*</span></Label>
                          <Input value={contact.name} onChange={(e) => updateContact(index, "name", e.target.value)} placeholder="Contact name" required />
                        </div>
                        <div className="space-y-2">
                          <Label>Title / Role</Label>
                          <Input value={contact.title} onChange={(e) => updateContact(index, "title", e.target.value)} placeholder="e.g. Research Manager" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input type="email" value={contact.email} onChange={(e) => updateContact(index, "email", e.target.value)} placeholder="contact@example.com" />
                        </div>
                        <div className="space-y-2">
                          <Label>Phone</Label>
                          <Input value={contact.phone} onChange={(e) => updateContact(index, "phone", e.target.value)} placeholder="+86 ..." />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 pt-6">
                      <Button type="button" variant={contact.isPrimary ? "default" : "ghost"} size="icon" onClick={() => updateContact(index, "isPrimary", !contact.isPrimary)}>
                        <Star className={`h-4 w-4 ${contact.isPrimary ? "fill-current" : "text-gray-400"}`} />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeContact(index)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {mode === "create" ? "Create Client" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
