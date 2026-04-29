// src/components/redesign/cockpit.tsx
import { cn } from "@/lib/utils";

interface CockpitProps {
  /** mono uppercase tag, e.g. "STAGE_01 · INQUIRY" */
  tag: string;
  /** plain Inter title, e.g. "Inquiry & estimation" */
  title: string;
  /** trailing context line (rendered in mono) */
  context?: React.ReactNode;
  /** primary status color used for the leading bullet */
  tagColor?: string;
  children: React.ReactNode;
}

export function Cockpit({ tag, title, context, tagColor = "var(--color-ink-700)", children }: CockpitProps) {
  return (
    <section className="border-t border-ink-900 border-b border-hairline pt-4 pb-5 mb-7">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
        <div>
          <span
            className="font-mono text-[10px] font-bold tracking-[0.10em] uppercase inline-flex items-center gap-2 mr-2"
            style={{ color: tagColor }}
          >
            <span aria-hidden style={{ color: tagColor }} className="text-[8px]">●</span>
            {tag}
          </span>
          <span className="text-[22px] font-bold tracking-[-0.02em] text-ink-900">{title}</span>
        </div>
        {context ? (
          <span className="font-mono text-[10px] text-ink-400 tracking-[0.04em] inline-flex items-center gap-3">
            {context}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

interface ReadoutProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  /** dot color */
  dotColor?: string;
  /** make the dot blink */
  blink?: boolean;
  /** muted (zero/empty state) */
  muted?: boolean;
  /** warning tone */
  warn?: boolean;
  className?: string;
}

export function Readout({ label, value, unit, dotColor, blink, muted, warn, className }: ReadoutProps) {
  return (
    <div
      className={cn(
        "px-4 first:pl-0 last:pr-0 last:border-r-0 border-r border-hairline cursor-pointer hover:bg-black/[0.02] transition-colors",
        className,
      )}
    >
      <p className="font-mono text-[9px] font-bold tracking-[0.08em] uppercase text-ink-400 mb-2 flex items-center gap-1.5">
        {dotColor ? (
          <span
            className={cn("w-1.5 h-1.5 rounded-full shrink-0", blink && "rd-blink")}
            style={{ backgroundColor: dotColor, boxShadow: `0 0 0 2px ${dotColor.replace(")", "-bg)")}` }}
          />
        ) : null}
        {label}
      </p>
      <div
        className={cn(
          "font-sans text-[32px] font-extrabold tracking-[-0.03em] leading-none rd-tabular mb-1",
          muted && "text-ink-300",
          warn && "text-warn-fg",
          !muted && !warn && "text-ink-900",
        )}
      >
        {value}
      </div>
      {unit ? <div className="font-mono text-[10px] text-ink-400 tracking-[0.04em]">{unit}</div> : null}
    </div>
  );
}

interface StatusRowProps {
  cells: { label: string; value: React.ReactNode; warn?: boolean; under?: boolean }[];
  trailing?: React.ReactNode;
}

export function StatusRow({ cells, trailing }: StatusRowProps) {
  return (
    <div className="mt-4 pt-3.5 border-t border-dashed border-hairline flex gap-4 flex-wrap font-mono text-[11px] text-ink-500 tracking-[0.02em]">
      {cells.map((c, i) => (
        <span key={i}>
          {c.label}: <strong className={cn("text-ink-900 font-bold", c.under && "text-var-under", c.warn && "text-warn-fg")}>{c.value}</strong>
        </span>
      ))}
      {trailing ? <span className="ml-auto">{trailing}</span> : null}
    </div>
  );
}
