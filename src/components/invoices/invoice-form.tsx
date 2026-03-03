"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react";

interface Project {
  id: string;
  projectNumber: string;
  title: string;
  client: { company: string };
}

interface LineItemInput {
  _key: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceFormProps {
  defaultProjectId?: string;
}

function newKey() {
  return Math.random().toString(36).slice(2);
}

export function InvoiceForm({ defaultProjectId }: InvoiceFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

  const [projectId, setProjectId] = useState(defaultProjectId || "");
  const [issuedDate, setIssuedDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItemInput[]>(() =>
    [{ _key: newKey(), description: "", quantity: 1, unitPrice: 0 }]
  );

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch("/api/projects");
        if (res.ok) {
          const data = await res.json();
          setProjects(data);
        }
      } catch {
        toast.error("Failed to load projects");
      }
    }
    fetchProjects();
  }, []);

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      { _key: newKey(), description: "", quantity: 1, unitPrice: 0 },
    ]);
  }

  function removeLineItem(key: string) {
    setLineItems((prev) => prev.filter((li) => li._key !== key));
  }

  function updateLineItem(
    key: string,
    field: "description" | "quantity" | "unitPrice",
    value: string | number
  ) {
    setLineItems((prev) =>
      prev.map((li) => (li._key === key ? { ...li, [field]: value } : li))
    );
  }

  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const fmt = (n: number) =>
    n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) {
      toast.error("Please select a project");
      return;
    }
    for (const li of lineItems) {
      if (!li.description.trim()) {
        toast.error("All line items must have a description");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          issuedDate: issuedDate || null,
          dueDate: dueDate || null,
          taxRate,
          notes: notes.trim() || null,
          contactEmail: contactEmail.trim() || null,
          lineItems: lineItems.map((li, i) => ({
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            sortOrder: i,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create invoice");
      }

      const invoice = await res.json();
      toast.success("Invoice created");
      router.push(`/invoices/${invoice.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create invoice");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="projectId">Project *</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.projectNumber} — {p.title} ({p.client.company})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="issuedDate">Issue Date</Label>
              <Input
                id="issuedDate"
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxRate">Tax Rate (%)</Label>
              <Input
                id="taxRate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactEmail">Contact Email</Label>
            <Input
              id="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="billing@client.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Line Items</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </CardHeader>
        <CardContent>
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 mb-2 px-1">
            <div className="col-span-5 text-xs font-medium text-gray-500">Description</div>
            <div className="col-span-2 text-xs font-medium text-gray-500">Qty</div>
            <div className="col-span-3 text-xs font-medium text-gray-500">Unit Price</div>
            <div className="col-span-1 text-xs font-medium text-gray-500 text-right">Total</div>
            <div className="col-span-1" />
          </div>

          <div className="space-y-2">
            {lineItems.map((item) => (
              <div key={item._key} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <Input
                    value={item.description}
                    onChange={(e) => updateLineItem(item._key, "description", e.target.value)}
                    placeholder="Description"
                    className="text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={item.quantity}
                    onChange={(e) =>
                      updateLineItem(item._key, "quantity", parseFloat(e.target.value) || 0)
                    }
                    className="text-sm"
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) =>
                      updateLineItem(item._key, "unitPrice", parseFloat(e.target.value) || 0)
                    }
                    className="text-sm"
                  />
                </div>
                <div className="col-span-1 text-right">
                  <span className="text-sm font-medium text-gray-700">
                    {fmt(item.quantity * item.unitPrice)}
                  </span>
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLineItem(item._key)}
                    className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                    disabled={lineItems.length === 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-6 pt-4 border-t">
            <div className="max-w-xs ml-auto space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">${fmt(subtotal)}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax ({taxRate}%)</span>
                  <span className="font-medium">${fmt(tax)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-lg">${fmt(total)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Payment instructions, terms, or other notes..."
            rows={4}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Create Invoice
        </Button>
      </div>
    </form>
  );
}
