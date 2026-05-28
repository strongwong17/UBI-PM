"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface Row {
  projectId: string;
  projectNumber: string;
  title: string;
  status: string;
  company: string;
  ownerId: string | null;
  ownerName: string | null;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
}

type Group = "company" | "owner" | "flat";

export function FinancialsTable({ rows, sym }: { rows: Row[]; sym: string }) {
  const router = useRouter();
  const [group, setGroup] = useState<Group>("company");
  const [status, setStatus] = useState<string>("ALL");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filtered = useMemo(
    () => (status === "ALL" ? rows : rows.filter((r) => r.status === status)),
    [rows, status]
  );

  const fmt = (n: number) => `${sym}${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const pct = (m: number, r: number) => (r > 0 ? ((m / r) * 100).toFixed(1) + "%" : "—");

  const groups = useMemo(() => {
    if (group === "flat") return null;
    const key = (r: Row) => (group === "company" ? r.company : r.ownerName ?? "Unassigned");
    const map = new Map<string, Row[]>();
    for (const r of filtered) {
      const k = key(r);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return Array.from(map.entries())
      .map(([name, items]) => {
        const revenue = items.reduce((s, r) => s + r.revenue, 0);
        const cost = items.reduce((s, r) => s + r.cost, 0);
        return { name, items, revenue, cost, margin: revenue - cost };
      })
      .sort((a, b) => b.margin - a.margin);
  }, [filtered, group]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 text-[11px] font-mono text-ink-500">
        <span>Group:</span>
        {(["company", "owner", "flat"] as Group[]).map((g) => (
          <button
            key={g}
            onClick={() => setGroup(g)}
            className={group === g ? "text-accent-rd font-bold" : "hover:text-ink-900"}
          >
            {g}
          </button>
        ))}
        <span className="ml-4">Status:</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-hairline-strong rounded px-1 py-0.5 bg-transparent">
          {["ALL", "IN_PROGRESS", "DELIVERED", "CLOSED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left font-mono text-[9px] uppercase tracking-[0.05em] text-ink-400">
            <th className="py-2">Project / group</th><th>Owner</th><th>Status</th>
            <th className="text-right">Revenue</th><th className="text-right">Cost</th>
            <th className="text-right">Margin</th><th className="text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {group === "flat"
            ? filtered.map((r) => <ProjectRow key={r.projectId} r={r} sym={sym} onClick={() => router.push(`/financials/${r.projectId}`)} />)
            : groups!.map((g) => (
                <FragmentGroup
                  key={g.name}
                  g={g}
                  open={!!expanded[g.name]}
                  toggle={() => setExpanded((p) => ({ ...p, [g.name]: !p[g.name] }))}
                  sym={sym}
                  fmt={fmt}
                  pct={pct}
                  onProject={(id) => router.push(`/financials/${id}`)}
                />
              ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectRow({ r, sym, onClick }: { r: Row; sym: string; onClick: () => void }) {
  const fmt = (n: number) => `${sym}${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return (
    <tr className="border-t border-hairline hover:bg-[#FCFAF6] cursor-pointer" onClick={onClick}>
      <td className="py-2 pl-4">{r.title} <span className="font-mono text-[10px] text-ink-400">{r.projectNumber}</span></td>
      <td className="text-ink-500">{r.ownerName ?? "—"}</td>
      <td><span className="font-mono text-[9px] text-ink-500">{r.status}</span></td>
      <td className="text-right rd-tabular">{fmt(r.revenue)}</td>
      <td className="text-right rd-tabular text-accent-rd">{fmt(r.cost)}</td>
      <td className="text-right rd-tabular">{fmt(r.margin)}</td>
      <td className="text-right rd-tabular">{r.revenue > 0 ? ((r.margin / r.revenue) * 100).toFixed(1) + "%" : "—"}</td>
    </tr>
  );
}

function FragmentGroup({
  g, open, toggle, sym, fmt, pct, onProject,
}: {
  g: { name: string; items: Row[]; revenue: number; cost: number; margin: number };
  open: boolean; toggle: () => void; sym: string;
  fmt: (n: number) => string; pct: (m: number, r: number) => string;
  onProject: (id: string) => void;
}) {
  return (
    <>
      <tr className="border-t border-hairline-strong bg-[#FAF8F2] font-semibold cursor-pointer" onClick={toggle}>
        <td className="py-2">{open ? "▾" : "▸"} {g.name} <span className="font-mono text-[10px] text-ink-400">{g.items.length} prj</span></td>
        <td></td><td></td>
        <td className="text-right rd-tabular">{fmt(g.revenue)}</td>
        <td className="text-right rd-tabular text-accent-rd">{fmt(g.cost)}</td>
        <td className="text-right rd-tabular">{fmt(g.margin)}</td>
        <td className="text-right rd-tabular">{pct(g.margin, g.revenue)}</td>
      </tr>
      {open && g.items.map((r) => <ProjectRow key={r.projectId} r={r} sym={sym} onClick={() => onProject(r.projectId)} />)}
    </>
  );
}
