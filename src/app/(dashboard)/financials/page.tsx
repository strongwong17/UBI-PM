import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadProjectFinancials, sumMargins } from "@/lib/financials";
import { FinancialsTable, type Row } from "@/components/financials/financials-table";

export default async function FinancialsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "MANAGER") redirect("/");

  const projectRows = await loadProjectFinancials({ usdOnly: true });
  const totals = sumMargins(projectRows);
  const sym = "$";
  const fmt = (n: number) => `${sym}${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  // by-owner rollup
  const ownerMap = new Map<string, { name: string; revenue: number; cost: number; count: number }>();
  for (const r of projectRows) {
    const key = r.ownerId ?? "none";
    const name = r.ownerName ?? "Unassigned";
    const o = ownerMap.get(key) ?? { name, revenue: 0, cost: 0, count: 0 };
    o.revenue += r.margin.plannedRevenue;
    o.cost += r.margin.cost;
    o.count += 1;
    ownerMap.set(key, o);
  }
  const owners = Array.from(ownerMap.values());

  const rows: Row[] = projectRows.map((r) => ({
    projectId: r.projectId,
    projectNumber: r.projectNumber,
    title: r.title,
    status: r.status,
    company: r.company,
    ownerId: r.ownerId,
    ownerName: r.ownerName,
    revenue: r.margin.plannedRevenue,
    cost: r.margin.cost,
    margin: r.margin.plannedMargin,
    marginPct: r.margin.plannedMarginPct,
  }));

  const companies = new Set(projectRows.map((r) => r.company)).size;

  return (
    <div className="space-y-6">
      <h1 className="text-[22px] font-bold tracking-[-0.025em] text-ink-900 m-0">Financial health</h1>

      {/* hero */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-[#EEF6EC] rounded-[14px] p-4 col-span-2 md:col-span-1" style={{ border: "1px solid #BCDCB2" }}>
          <div className="font-mono text-[9px] font-bold uppercase text-ink-400 mb-1.5">{"// OVERALL MARGIN"}</div>
          <div className="text-[24px] font-bold rd-tabular text-emerald-700">{fmt(totals.margin)}</div>
          <div className="text-[11px] text-ink-500">{totals.marginPct.toFixed(1)}% on {fmt(totals.revenue)}</div>
        </div>
        <HeroCard label="// REVENUE" v={fmt(totals.revenue)} />
        <HeroCard label="// COST" v={fmt(totals.cost)} accent />
        <HeroCard label="// PASSTHROUGH" v={fmt(totals.passthrough)} />
        <HeroCard label="// PORTFOLIO" v={`${companies} cos · ${totals.count} prj`} />
      </div>

      {/* by individual */}
      <section>
        <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">{"// BY INDIVIDUAL (BD owner)"}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {owners.map((o) => {
            const m = o.revenue - o.cost;
            return (
              <div key={o.name} className="bg-card-rd rounded-[12px] p-3" style={{ border: "1px solid var(--color-hairline)" }}>
                <div className="font-semibold text-[13px]">{o.name} <span className="text-ink-400 font-normal text-[11px]">· {o.count} prj</span></div>
                <div className="flex justify-between text-[12px] text-ink-500 mt-1">
                  <span>Rev / Cost</span><span className="rd-tabular">{fmt(o.revenue)} / {fmt(o.cost)}</span>
                </div>
                <div className="flex justify-between text-[12px] mt-0.5">
                  <span className="text-ink-500">Margin</span>
                  <span className="rd-tabular font-semibold text-emerald-700">{fmt(m)} · {o.revenue > 0 ? ((m / o.revenue) * 100).toFixed(1) : "0.0"}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* by company / table */}
      <section>
        <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">{"// PROJECTS — click a project to log costs"}</p>
        <div className="bg-card-rd rounded-[14px] p-4" style={{ border: "1px solid var(--color-hairline)" }}>
          {rows.length === 0 ? (
            <p className="text-[13px] text-ink-500">No USD projects with an approved estimate yet.</p>
          ) : (
            <FinancialsTable rows={rows} sym={sym} />
          )}
        </div>
      </section>
    </div>
  );
}

function HeroCard({ label, v, accent }: { label: string; v: string; accent?: boolean }) {
  return (
    <div className="bg-card-rd rounded-[14px] p-4" style={{ border: "1px solid var(--color-hairline)" }}>
      <div className="font-mono text-[9px] font-bold uppercase text-ink-400 mb-1.5">{label}</div>
      <div className={`text-[20px] font-bold rd-tabular ${accent ? "text-accent-rd" : "text-ink-900"}`}>{v}</div>
    </div>
  );
}
