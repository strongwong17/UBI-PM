"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ArchiveButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function archive() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      });
      if (!res.ok) {
        setError("Failed to archive");
        setBusy(false);
        return;
      }
      router.refresh();
      // leave busy=true so the button stays disabled until the refresh re-renders the row out
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={archive}
      className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.04em] text-white disabled:opacity-50"
      style={{ background: "var(--color-ink-900)" }}
      title={error ?? undefined}
    >
      {busy ? "Archiving…" : "Archive →"}
    </button>
  );
}
