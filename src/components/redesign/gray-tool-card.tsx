// src/components/redesign/gray-tool-card.tsx
"use client";

import { showUnderDevToast } from "./under-dev-toast";

interface Props {
  icon: string; // emoji or short glyph
  name: string;
  desc: string;
}

export function GrayToolCard({ icon, name, desc }: Props) {
  return (
    <button
      type="button"
      onClick={() => showUnderDevToast(name)}
      className="text-left bg-white/50 border border-dashed border-ink-200 rounded-[10px] px-4 py-3.5 cursor-pointer transition-all hover:bg-white/80 hover:border-ink-300 hover:-translate-y-0.5"
      style={{ filter: "grayscale(0.7)" }}
    >
      <div className="text-base mb-1.5 text-ink-400" style={{ filter: "grayscale(1)" }}>
        {icon}
      </div>
      <div className="text-xs font-bold text-ink-500 tracking-[-0.005em] mb-1">{name}</div>
      <div className="text-[11px] text-ink-400 leading-[1.5]">{desc}</div>
    </button>
  );
}
