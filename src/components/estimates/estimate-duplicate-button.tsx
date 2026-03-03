"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EstimateDuplicateButtonProps {
  estimateId: string;
}

export function EstimateDuplicateButton({ estimateId }: EstimateDuplicateButtonProps) {
  const router = useRouter();
  const [isDuplicating, setIsDuplicating] = useState(false);

  async function handleDuplicate() {
    setIsDuplicating(true);
    try {
      const res = await fetch(`/api/estimates/${estimateId}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to duplicate estimate");
      }
      const duplicate = await res.json();
      toast.success("Estimate duplicated");
      router.push(`/estimates/${duplicate.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to duplicate estimate");
      setIsDuplicating(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={isDuplicating}>
      {isDuplicating ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Copy className="h-4 w-4 mr-2" />
      )}
      {isDuplicating ? "Duplicating..." : "Duplicate"}
    </Button>
  );
}
