"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MoreHorizontal,
  Pencil,
  Copy,
  Languages,
  XCircle,
  Trash2,
  ExternalLink,
  Loader2,
} from "lucide-react";

interface EstimateCardActionsProps {
  estimateId: string;
  estimateNumber: string;
  estimateTitle: string;
  isApproved: boolean;
  isRmbDuplicate: boolean;
  hasRmbDuplicate: boolean;
}

export function EstimateCardActions({
  estimateId,
  estimateNumber,
  estimateTitle,
  isApproved,
  isRmbDuplicate,
  hasRmbDuplicate,
}: EstimateCardActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [unapproveOpen, setUnapproveOpen] = useState(false);
  const [rmbOpen, setRmbOpen] = useState(false);
  const [exchangeRate, setExchangeRate] = useState("7.25");
  const [additionalTaxRate, setAdditionalTaxRate] = useState("10");

  async function handleDuplicate() {
    setLoading("duplicate");
    try {
      const res = await fetch(`/api/estimates/${estimateId}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const dup = await res.json();
      toast.success("Estimate duplicated");
      router.push(`/estimates/${dup.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to duplicate");
    } finally {
      setLoading(null);
    }
  }

  async function handleDelete() {
    setLoading("delete");
    try {
      const res = await fetch(`/api/estimates/${estimateId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast.success("Estimate deleted");
      setDeleteOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setLoading(null);
    }
  }

  async function handleUnapprove() {
    setLoading("unapprove");
    try {
      const res = await fetch(`/api/estimates/${estimateId}/approve`, { method: "PATCH" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast.success("Estimate unapproved");
      setUnapproveOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unapprove");
    } finally {
      setLoading(null);
    }
  }

  async function handleCreateRmb() {
    const rate = parseFloat(exchangeRate);
    const taxRate = parseFloat(additionalTaxRate);
    if (!rate || rate <= 0) { toast.error("Enter a valid exchange rate"); return; }
    setLoading("rmb");
    try {
      const res = await fetch(`/api/estimates/${estimateId}/rmb-duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exchangeRate: rate, additionalTaxRate: taxRate }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast.success("RMB estimate created");
      setRmbOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create RMB estimate");
    } finally {
      setLoading(null);
    }
  }

  // Consistent menu item style
  const itemClass = "flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium min-h-[36px] cursor-pointer transition-colors duration-150";
  const iconClass = "h-4 w-4 shrink-0 opacity-60";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-gray-700 transition-colors duration-150">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 p-1 rounded-lg shadow-lg border border-gray-200/80">
          {/* View & Edit group */}
          <DropdownMenuItem asChild className={itemClass}>
            <Link href={`/estimates/${estimateId}`}>
              <ExternalLink className={iconClass} />
              View Details
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className={itemClass}>
            <Link href={`/estimates/${estimateId}/edit`}>
              <Pencil className={iconClass} />
              Edit Estimate
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1" />

          {/* Actions group */}
          <DropdownMenuItem
            onClick={handleDuplicate}
            disabled={!!loading}
            className={itemClass}
          >
            {loading === "duplicate"
              ? <Loader2 className={`${iconClass} animate-spin`} />
              : <Copy className={iconClass} />}
            Duplicate
          </DropdownMenuItem>

          {!isRmbDuplicate && !hasRmbDuplicate && (
            <DropdownMenuItem
              onClick={() => setRmbOpen(true)}
              className={itemClass}
            >
              <Languages className={iconClass} />
              Create RMB Version
            </DropdownMenuItem>
          )}

          {/* Destructive group */}
          {(isApproved || true) && <DropdownMenuSeparator className="my-1" />}

          {isApproved && (
            <DropdownMenuItem
              onClick={() => setUnapproveOpen(true)}
              className={`${itemClass} text-orange-600 focus:text-orange-600 focus:bg-orange-50`}
            >
              <XCircle className="h-4 w-4 shrink-0" />
              Unapprove
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className={`${itemClass} text-red-600 focus:text-red-600 focus:bg-red-50`}
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Estimate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{estimateTitle}&quot;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={!!loading} className="bg-red-600 hover:bg-red-700">
              {loading === "delete" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unapprove confirmation */}
      <AlertDialog open={unapproveOpen} onOpenChange={setUnapproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unapprove Estimate?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove approval. If no other estimates are approved, the project status will revert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnapprove} disabled={!!loading}>
              {loading === "unapprove" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Unapprove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* RMB creation dialog */}
      <Dialog open={rmbOpen} onOpenChange={setRmbOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create RMB Estimate</DialogTitle>
            <DialogDescription>
              Create a Chinese RMB version of {estimateNumber}. All prices will be converted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Exchange Rate (1 USD = ? CNY)</Label>
              <Input type="number" min={0} step="0.01" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Additional Tax Rate (%)</Label>
              <Input type="number" min={0} step="0.1" value={additionalTaxRate} onChange={(e) => setAdditionalTaxRate(e.target.value)} />
              <p className="text-xs text-muted-foreground">Added on top of the original tax rate.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRmbOpen(false)} disabled={!!loading}>Cancel</Button>
            <Button onClick={handleCreateRmb} disabled={!!loading}>
              {loading === "rmb" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
