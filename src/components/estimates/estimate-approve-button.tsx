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
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface EstimateApproveButtonProps {
  estimateId: string;
  isApproved: boolean;
  version: number;
}

export function EstimateApproveButton({
  estimateId,
  isApproved,
  version,
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
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="outline" className="border-orange-400 text-orange-700 hover:bg-orange-50">
            <XCircle className="h-4 w-4 mr-1" />
            Unapprove
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unapprove This Estimate?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove approval from this estimate. If no other estimates are approved,
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

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-green-500 text-green-700 hover:bg-green-50">
          <CheckCircle className="h-4 w-4 mr-1" />
          Approve
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Approve This Estimate?</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark this estimate as approved. The project status will be updated
            to &quot;Approved&quot;. Multiple estimates can be approved simultaneously.
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
