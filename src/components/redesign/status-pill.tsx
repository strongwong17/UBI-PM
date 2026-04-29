// src/components/redesign/status-pill.tsx
import { statusTokens } from "@/lib/redesign-tokens";
import { cn } from "@/lib/utils";

interface Props {
  status: string;
  /** Override label; defaults to formatted status (e.g. "IN_PROGRESS" → "In Progress") */
  label?: string;
  /** Size: sm (default) or xs */
  size?: "xs" | "sm";
  className?: string;
}

function formatStatus(status: string): string {
  return status
    .split("_")
    .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
    .join(" ");
}

export function StatusPill({ status, label, size = "sm", className }: Props) {
  const t = statusTokens(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold tracking-tight",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[9px]",
        className,
      )}
      style={{ backgroundColor: t.bg, color: t.fg }}
    >
      <span
        className="rounded-full"
        style={{
          width: size === "sm" ? 5 : 4,
          height: size === "sm" ? 5 : 4,
          backgroundColor: t.dot,
        }}
      />
      {label ?? formatStatus(status)}
    </span>
  );
}
