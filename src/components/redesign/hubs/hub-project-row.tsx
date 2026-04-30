import Link from "next/link";
import { currencySymbol } from "@/lib/currency";

export interface HubProjectRowData {
  id: string;
  projectNumber: string;
  title: string;
  status: string;
  executionPhase: string | null;
  updatedAt: Date;
  client: { company: string };
  estimates: { isApproved: boolean; total: number; currency: string }[];
}

export type HubKind = "inquiry" | "in-progress" | "completion" | "archive";

function pillForHub(kind: HubKind, p: HubProjectRowData): { label: string; bg: string; fg: string; dot: string } {
  if (kind === "inquiry") {
    const map: Record<string, { bg: string; fg: string; dot: string }> = {
      NEW:        { bg: "var(--color-canvas-cool)", fg: "var(--color-ink-500)", dot: "var(--color-ink-300)" },
      BRIEFED:    { bg: "var(--color-s-briefed-bg)", fg: "var(--color-s-briefed-fg)", dot: "var(--color-s-briefed)" },
      ESTIMATING: { bg: "var(--color-s-estimating-bg)", fg: "var(--color-s-estimating-fg)", dot: "var(--color-s-estimating)" },
    };
    const t = map[p.status] ?? map.NEW;
    return { label: p.status, ...t };
  }
  if (kind === "in-progress") {
    const phase = p.executionPhase ?? "NO_PHASE";
    const map: Record<string, { bg: string; fg: string; dot: string }> = {
      RECRUITMENT: { bg: "rgba(101, 163, 13, 0.10)", fg: "var(--color-p-recruit-fg)", dot: "var(--color-p-recruit)" },
      FIELDWORK:   { bg: "rgba(245, 158, 11, 0.10)", fg: "var(--color-p-field-fg)", dot: "var(--color-p-field)" },
      ANALYSIS:    { bg: "rgba(99, 102, 241, 0.10)", fg: "var(--color-p-analyze-fg)", dot: "var(--color-p-analyze)" },
      REPORTING:   { bg: "rgba(236, 72, 153, 0.10)", fg: "var(--color-p-report-fg)", dot: "var(--color-p-report)" },
      NO_PHASE:    { bg: "var(--color-canvas-cool)", fg: "var(--color-ink-500)", dot: "var(--color-ink-300)" },
    };
    const t = map[phase] ?? map.NO_PHASE;
    const label = phase === "NO_PHASE" ? "NO PHASE" : phase;
    return { label, ...t };
  }
  if (kind === "completion") {
    return {
      label: "DELIVERED",
      bg: "var(--color-s-delivered-bg)",
      fg: "var(--color-s-delivered-fg)",
      dot: "var(--color-s-delivered)",
    };
  }
  // archive
  if (p.status === "EXPIRED") {
    return { label: "EXPIRED", bg: "#F4F4F5", fg: "#71717A", dot: "#A1A1AA" };
  }
  return {
    label: "CLOSED",
    bg: "var(--color-s-closed-bg)",
    fg: "var(--color-s-closed-fg)",
    dot: "var(--color-s-closed)",
  };
}

function approvedValue(p: HubProjectRowData): string {
  const e = p.estimates.find((x) => x.isApproved);
  if (!e) return "—";
  return `${currencySymbol(e.currency)}${e.total.toLocaleString()}`;
}

function daysAgo(d: Date): string {
  const ms = Date.now() - d.getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

export function HubProjectRow({
  project,
  kind,
  trailing,
}: {
  project: HubProjectRowData;
  kind: HubKind;
  trailing?: React.ReactNode;
}) {
  const pill = pillForHub(kind, project);
  const value = approvedValue(project);
  return (
    <Link
      href={`/projects/${project.id}`}
      className="grid items-center gap-3.5 px-4 py-3 border-b border-hairline last:border-b-0 hover:bg-[#FCFAF6] transition-colors text-xs"
      style={{ gridTemplateColumns: "4px 1fr auto auto auto 24px" }}
    >
      <span className="w-1 h-9 rounded-full" style={{ background: pill.dot }} />
      <span>
        <span className="font-mono text-[10px] text-ink-300 tracking-[0.04em]">{project.projectNumber}</span>
        <div className="text-[13px] font-medium text-ink-900 mt-0.5 tracking-[-0.005em]">{project.title}</div>
        <div className="text-[11px] text-ink-500">{project.client.company}</div>
      </span>
      <span
        className="inline-flex items-center gap-1 px-2 py-1 rounded-full font-mono text-[10px] font-bold tracking-[0.02em]"
        style={{ background: pill.bg, color: pill.fg }}
      >
        <span className="w-1 h-1 rounded-full" style={{ background: pill.dot }} />
        {pill.label}
      </span>
      <span className="text-right">
        <div className="text-xs text-ink-700 font-medium rd-tabular">{value}</div>
        <div className="font-mono text-[10px] text-ink-400 mt-0.5 tracking-[0.02em]">touched {daysAgo(project.updatedAt)}</div>
      </span>
      <span className="text-right">{trailing}</span>
      <span className="text-ink-300 text-sm text-right">›</span>
    </Link>
  );
}

export function HubEmptyState({ hubLabel }: { hubLabel: string }) {
  return (
    <div
      className="rounded-xl p-6 text-center font-mono text-[11px] text-ink-400 tracking-[0.04em]"
      style={{ background: "#FAFAF6", border: "1px dashed var(--color-hairline-strong)" }}
    >
      {`// STDBY · NO PROJECTS IN ${hubLabel.toUpperCase()}`}
    </div>
  );
}
