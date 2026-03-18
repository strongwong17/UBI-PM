"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Languages } from "lucide-react";

interface CreateRmbEstimateButtonProps {
  estimateId: string;
  estimateNumber: string;
  hasRmbDuplicate: boolean;
}

export function CreateRmbEstimateButton({
  estimateId,
  estimateNumber,
  hasRmbDuplicate,
}: CreateRmbEstimateButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exchangeRate, setExchangeRate] = useState("7.25");
  const [additionalTaxRate, setAdditionalTaxRate] = useState("10");

  async function handleCreate() {
    const rate = parseFloat(exchangeRate);
    const taxRate = parseFloat(additionalTaxRate);
    if (!rate || rate <= 0) {
      toast.error("Please enter a valid exchange rate");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/estimates/${estimateId}/rmb-duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exchangeRate: rate, additionalTaxRate: taxRate }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create RMB estimate");
      }

      toast.success("RMB estimate created");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create RMB estimate");
    } finally {
      setLoading(false);
    }
  }

  if (hasRmbDuplicate) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Languages className="h-4 w-4 mr-2" />
          RMB Version
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create RMB Estimate</DialogTitle>
          <DialogDescription>
            Create a Chinese RMB version of {estimateNumber}. All prices will be
            converted using the exchange rate, with an additional tax rate applied.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Exchange Rate (1 USD = ? CNY)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              placeholder="e.g. 7.25"
            />
          </div>
          <div className="space-y-2">
            <Label>Additional Tax Rate (%)</Label>
            <Input
              type="number"
              min={0}
              step="0.1"
              value={additionalTaxRate}
              onChange={(e) => setAdditionalTaxRate(e.target.value)}
              placeholder="e.g. 10"
            />
            <p className="text-xs text-gray-500">
              This tax rate will be added on top of the original estimate&apos;s tax rate.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create RMB Estimate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
