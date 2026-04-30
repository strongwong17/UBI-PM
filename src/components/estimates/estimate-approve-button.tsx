"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface EstimateApproveButtonProps {
  estimateId: string;
  isApproved: boolean;
  version: number;
}

export function EstimateApproveButton({
  estimateId,
  isApproved,
}: EstimateApproveButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/estimates/${estimateId}/approve`, {
        method: "PATCH",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update approval");
      }
      toast.success(isApproved ? "Estimate unapproved" : "Estimate approved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update approval");
    } finally {
      setLoading(false);
    }
  }

  if (isApproved) {
    // Unapprove — shown inside dropdown menu, compact style
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button className="flex items-center gap-2 text-sm text-orange-600 hover:text-orange-800 transition-colors w-full px-2 py-1.5">
            <XCircle className="h-3.5 w-3.5" />
            Unapprove
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unapprove This Estimate?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove approval. If no other estimates are approved,
              the project status will revert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggle} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Unapprove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Approve — inline chip styled to match the redesign action vocabulary
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white tracking-[-0.005em] transition-colors disabled:opacity-50"
          style={{
            background: "var(--color-s-delivered)",
            boxShadow: "0 4px 12px -2px rgba(5, 150, 105, 0.28)",
          }}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Approve
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Approve This Estimate?</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark this estimate as approved and set the project to In Progress.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleToggle} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Approve
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
