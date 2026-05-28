"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Props {
  projectId: string;
  lineItemId: string;
  initial: boolean;
}

/** Per-line manual passthrough override for the project Financials revenue
 *  panel. INCENTIVES lines are auto-passthrough and don't render this toggle. */
export function PassthroughToggle({ projectId, lineItemId, initial }: Props) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !on;
    setOn(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/revenue-passthrough`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateLineItemId: lineItemId, isPassthrough: next }),
      });
      if (!res.ok) throw new Error("Failed to update passthrough");
      toast.success(next ? "Marked as passthrough" : "Unmarked passthrough");
      router.refresh();
    } catch (e) {
      setOn(!next);
      toast.error(e instanceof Error ? e.message : "Failed to update passthrough");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
        on
          ? "bg-ink-900/[0.06] text-ink-700 border-hairline-strong"
          : "text-ink-400 border-hairline hover:text-ink-700"
      }`}
    >
      {on ? "passthrough ✓" : "mark passthrough"}
    </button>
  );
}
