"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
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

interface DeleteInvoiceButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  projectId: string;
  status: string;
}

export function DeleteInvoiceButton({
  invoiceId,
  invoiceNumber,
  projectId,
  status,
}: DeleteInvoiceButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isPaid = status === "PAID";

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(d.error || "Failed to delete invoice");
      }
      toast.success(`Invoice ${invoiceNumber} deleted`);
      router.push(`/projects/${projectId}?tab=invoice`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete invoice");
      setLoading(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-accent-rd hover:text-accent-rd" disabled={loading}>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          )}
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete invoice {invoiceNumber}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes {invoiceNumber} from all invoice lists and billing totals. It can be
            restored later by an admin if needed.
            {isPaid && (
              <>
                {" "}
                <strong className="text-accent-rd">
                  This invoice is marked PAID — deleting it will change the project&apos;s paid
                  total and may auto-close or re-open the project. Only continue if you are sure.
                </strong>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Delete invoice
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
