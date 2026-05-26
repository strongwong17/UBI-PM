"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReopenCorrectionButtonProps {
  invoiceId: string;
  projectId: string;
  estimateId: string;
}

export function ReopenCorrectionButton({
  invoiceId,
  projectId,
  estimateId,
}: ReopenCorrectionButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function reopen() {
    if (
      !window.confirm(
        "Reopen this invoice for correction? It moves back to DRAFT and returns to the Delivery & Sign-off stage so you can re-confirm the delivered quantities."
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DRAFT" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(d.error || "Failed to reopen");
      }
      router.push(
        `/projects/${projectId}?tab=completion&estimate=${estimateId}&correctInvoice=${invoiceId}`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reopen");
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={reopen} disabled={loading}>
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
      ) : (
        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
      )}
      Reopen for correction
    </Button>
  );
}
