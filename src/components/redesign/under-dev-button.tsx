"use client";

import { showUnderDevToast } from "./under-dev-toast";

export function UnderDevButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => showUnderDevToast(label)}
      className="px-3 py-1.5 rounded-md text-xs font-semibold border border-dashed border-ink-300 text-ink-700 cursor-pointer hover:border-ink-700 hover:border-solid"
    >
      {label}
    </button>
  );
}
