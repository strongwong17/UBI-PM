"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, Wand2 } from "lucide-react";

interface GenerateEstimateButtonProps {
  projectId: string;
  hasModules: boolean;
}

export function GenerateEstimateButton({ projectId, hasModules }: GenerateEstimateButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!hasModules) {
      toast.error("Add service modules to the brief first");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-estimate`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate estimate");
      }
      const estimate = await res.json();
      toast.success("Estimate generated successfully");
      router.refresh();
      // Navigate to estimates tab
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "estimates");
      router.push(url.pathname + url.search);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate estimate");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleClick} disabled={loading || !hasModules} size="sm">
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Wand2 className="h-4 w-4 mr-2" />
      )}
      Generate Estimate
    </Button>
  );
}
