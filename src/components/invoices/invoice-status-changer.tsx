"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["DRAFT", "SENT", "PAID", "OVERDUE"];

interface InvoiceStatusChangerProps {
  invoiceId: string;
  currentStatus: string;
}

export function InvoiceStatusChanger({ invoiceId, currentStatus }: InvoiceStatusChangerProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);

  async function changeStatus(newStatus: string) {
    if (newStatus === currentStatus) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }
      toast.success("Status updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isUpdating}>
          {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Change Status
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {STATUSES.filter((s) => s !== currentStatus).map((status) => (
          <DropdownMenuItem key={status} onClick={() => changeStatus(status)}>
            {status}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
