// src/components/redesign/under-dev-toast.tsx
"use client";

import { toast } from "sonner";

export function showUnderDevToast(featureName: string) {
  toast(
    <div>
      <div className="font-medium">{featureName} is under development.</div>
      <div className="text-[11px] text-white/60 font-mono mt-0.5">{"// Coming in a future release"}</div>
    </div>,
    {
      duration: 2400,
      style: {
        background: "var(--color-ink-900)",
        color: "white",
        border: "none",
        boxShadow: "0 12px 32px -8px rgba(15, 23, 41, 0.4)",
        fontSize: "13px",
        fontWeight: 500,
      },
    }
  );
}
