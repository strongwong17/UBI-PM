"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Receipt } from "lucide-react";

interface ApprovedEstimate {
  id: string;
  estimateNumber: string;
  version: number;
  label: string | null;
  hasInvoice: boolean;
}

interface GenerateInvoiceButtonProps {
  projectId: string;
  approvedEstimates: ApprovedEstimate[];
}

export function GenerateInvoiceButton({ projectId, approvedEstimates }: GenerateInvoiceButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedEstimateId, setSelectedEstimateId] = useState("");

  const available = approvedEstimates.filter((e) => !e.hasInvoice);

  async function handleGenerate() {
    if (!selectedEstimateId) {
      toast.error("Select an estimate first");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateId: selectedEstimateId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate invoice");
      }
      toast.success("Invoice generated successfully");
      router.refresh();
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "invoice");
      router.push(url.pathname + url.search);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate invoice");
    } finally {
      setLoading(false);
    }
  }

  if (available.length === 0) {
    return (
      <Button disabled size="sm">
        <Receipt className="h-4 w-4 mr-2" />
        Generate Invoice
      </Button>
    );
  }

  // If only one available, auto-select it
  if (available.length === 1 && !selectedEstimateId) {
    // We set it in the dialog trigger
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          onClick={() => {
            if (available.length === 1) setSelectedEstimateId(available[0].id);
          }}
        >
          <Receipt className="h-4 w-4 mr-2" />
          Generate Invoice
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Generate Invoice</AlertDialogTitle>
          <AlertDialogDescription>
            Select an approved estimate to generate an invoice from. The project status will be
            updated to &quot;Invoiced&quot;.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-2">
          <Select
            value={selectedEstimateId}
            onValueChange={setSelectedEstimateId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select estimate..." />
            </SelectTrigger>
            <SelectContent>
              {available.map((est) => (
                <SelectItem key={est.id} value={est.id}>
                  {est.estimateNumber} v{est.version}
                  {est.label ? ` — ${est.label}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setSelectedEstimateId("")}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleGenerate} disabled={loading || !selectedEstimateId}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Generate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
