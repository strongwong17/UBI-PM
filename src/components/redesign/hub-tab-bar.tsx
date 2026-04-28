// src/components/redesign/hub-tab-bar.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type HubKey = "inquiry" | "in-progress" | "completion" | "archive";

interface HubMeta {
  key: HubKey;
  label: string;
  count: number;
  /** dot color when not active */
  dotColor: string;
  /** glow color when active */
  activeGlow: string;
}

interface Props {
  hubs: HubMeta[];
  active: HubKey;
}

export function HubTabBar({ hubs, active }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const setHub = (key: HubKey) => {
    const next = new URLSearchParams(params?.toString() ?? "");
    next.set("hub", key);
    router.push(`?${next.toString()}`);
  };

  return (
    <div
      className="flex gap-1 mb-7 p-1 bg-card-rd border border-hairline rounded-[10px] w-fit"
      style={{ boxShadow: "0 1px 2px rgba(15,23,41,0.04)" }}
    >
      {hubs.map((h) => {
        const isActive = h.key === active;
        return (
          <button
            key={h.key}
            onClick={() => setHub(h.key)}
            className={cn(
              "px-4 py-2 rounded-[7px] text-xs font-semibold tracking-[-0.005em] inline-flex items-center gap-2 transition-colors",
              isActive ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-900",
            )}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={
                isActive
                  ? { background: h.activeGlow, boxShadow: `0 0 6px ${h.activeGlow}80` }
                  : { background: h.dotColor }
              }
            />
            {h.label}
            <span
              className={cn(
                "font-mono text-[11px] ml-1",
                isActive ? "text-white/55" : "text-ink-300",
              )}
            >
              {h.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
