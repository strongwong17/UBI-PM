"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface RestoreButtonProps {
  entityType: string; // ESTIMATE or INVOICE
  entityId: string;
  entityLabel?: string;
}

export function RestoreButton({ entityType, entityId, entityLabel }: RestoreButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const typeLower = entityType.toLowerCase();
  const endpoint = `/api/${typeLower}s/${entityId}/restore`;

  async function handleRestore() {
    setLoading(true);
    try {
      const res = await fetch(endpoint, { method: "PATCH" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to restore");
      }
      toast.success(`${entityLabel || entityType} restored successfully`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50">
          <RotateCcw className="h-3.5 w-3.5" />
          Restore
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore {entityLabel || typeLower}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will restore the deleted {typeLower} and make it visible again in the system.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRestore} disabled={loading}>
            {loading ? "Restoring..." : "Restore"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
