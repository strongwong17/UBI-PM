"use client";

import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  currentStatus: string;
  context: {
    hasInquiry: boolean;
    estimateCount: number;
    approvedEstimateCount: number;
    invoiceCount: number;
    hasUninvoicedApproved: boolean;
    updatedAt: string;
    startDate: string | null;
    contactEmail: string | null;
    contactName: string | null;
  };
}

const STAGES = [
  { key: "stage1", label: "1 · Inquiry", desc: "Build estimate, get approval", statuses: ["ESTIMATING"], color: "var(--color-s-estimating)", fg: "var(--color-s-estimating-fg)" },
  { key: "stage2", label: "2 · In Progress", desc: "Coordinate team & deliverables", statuses: ["IN_PROGRESS"], color: "var(--color-s-in-progress)", fg: "var(--color-s-in-progress-fg)" },
  { key: "stage3", label: "3 · Completion", desc: "Sign-off & feedback", statuses: ["DELIVERED"], color: "var(--color-s-delivered)", fg: "var(--color-s-delivered-fg)" },
  { key: "stage4", label: "4 · Archive", desc: "Auto-archived once paid + feedback collected", statuses: ["CLOSED", "EXPIRED"], color: "var(--color-s-closed)", fg: "var(--color-s-closed-fg)" },
];

function stageIndex(status: string): number {
  return STAGES.findIndex((s) => s.statuses.includes(status));
}

export function ProjectStatusStepper({ currentStatus }: Props) {
  const idx = stageIndex(currentStatus);
  return (
    <div className="grid grid-cols-4 gap-2.5 mb-5">
      {STAGES.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div
            key={s.key}
            className={cn(
              "rounded-[10px] px-3.5 py-3 border bg-card-rd shadow-sm",
              done && "bg-gradient-to-b from-[#FCFAF6] to-white",
            )}
            style={
              active
                ? { borderColor: s.color, boxShadow: `0 6px 18px -8px ${s.color}50` }
                : { borderColor: "var(--color-hairline)" }
            }
          >
            <div
              className="h-[3px] rounded-full mb-2.5"
              style={{
                background: done ? s.color : active ? s.color : "var(--color-hairline)",
              }}
            />
            <div
              className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase mb-0.5"
              style={{ color: done ? s.color : active ? s.fg : "var(--color-ink-400)" }}
            >
              {s.label}
            </div>
            <div className={cn("text-[11px]", active ? "text-ink-700" : "text-ink-400")}>
              {s.desc}
            </div>
          </div>
        );
      })}
    </div>
  );
}
