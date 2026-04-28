// src/components/redesign/hubs/hub-4-archive.tsx
import Link from "next/link";
import { Cockpit, Readout, StatusRow } from "@/components/redesign/cockpit";
import { GrayToolCard } from "@/components/redesign/gray-tool-card";

interface ProjectLite {
  id: string;
  projectNumber: string;
  title: string;
  status: string;
  updatedAt: Date;
  createdAt: Date;
  client: { company: string };
  estimates: { isApproved: boolean; total: number; currency: string }[];
}

interface Props { projects: ProjectLite[]; }

function fmtUSD(n: number) { return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`; }
function pad(n: number) { return n.toString().padStart(2, "0"); }

export function HubArchive({ projects }: Props) {
  const allTimeRevenue = projects.flatMap((p) => p.estimates.filter((e) => e.isApproved)).reduce((s, e) => s + e.total, 0);
  const last30 = projects.filter((p) => Date.now() - p.updatedAt.getTime() < 30 * 86_400_000);
  const last90 = projects.filter((p) => Date.now() - p.updatedAt.getTime() < 90 * 86_400_000);
  const avgProject = projects.length ? allTimeRevenue / projects.length : 0;

  // Group by year
  const byYear = new Map<number, ProjectLite[]>();
  for (const p of projects) {
    const y = p.updatedAt.getFullYear();
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(p);
  }
  const years = Array.from(byYear.keys()).sort((a, b) => b - a);

  // Top clients
  const byClient = new Map<string, { count: number; revenue: number }>();
  for (const p of projects) {
    const c = p.client.company;
    if (!byClient.has(c)) byClient.set(c, { count: 0, revenue: 0 });
    const r = byClient.get(c)!;
    r.count += 1;
    r.revenue += p.estimates.filter((e) => e.isApproved).reduce((s, e) => s + e.total, 0);
  }
  const topClients = Array.from(byClient.entries())
    .map(([name, r]) => ({ name, ...r }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return (
    <div>
      <Cockpit
        tag="STAGE_04 · ARCHIVE"
        title="Project knowledge library"
        tagColor="var(--color-s-closed-fg)"
        context={
          <>
            // <strong className="text-ink-900 font-bold">{projects.length} ARCHIVED</strong> · paid &amp; closed · browse to learn
          </>
        }
      >
        <div className="grid grid-cols-5 gap-0 items-end">
          <Readout label="TOTAL" value={pad(projects.length)} unit="closed projects" dotColor="var(--color-s-closed)" />
          <Readout label="LAST.30D" value={pad(last30.length)} unit="closed recently" muted={last30.length === 0} />
          <Readout label="LAST.90D" value={pad(last90.length)} unit="closed this quarter" muted={last90.length === 0} />
          <Readout
            label="REVENUE"
            value={
              <>
                {Math.round(allTimeRevenue / 1000)}<span className="text-[18px] font-semibold">K</span>
              </>
            }
            unit="all-time delivered"
          />
          <Readout
            label="AVG.PROJECT"
            value={
              <>
                {(avgProject / 1000).toFixed(1)}<span className="text-[18px] font-semibold">K</span>
              </>
            }
            unit="median size"
          />
        </div>
        <StatusRow
          cells={[
            { label: "STATUS", value: "ARCHIVE" },
            { label: "UNIQUE.CLIENTS", value: byClient.size.toString() },
            { label: "MOST.RECENT", value: projects[0] ? `${Math.floor((Date.now() - projects[0].updatedAt.getTime()) / 86_400_000)}d ago` : "—" },
            { label: "TOP.CLIENT", value: topClients[0]?.name ?? "—" },
          ]}
        />
      </Cockpit>

      {/* Search strip — visual only for now */}
      <div className="flex gap-2 mb-5 items-center flex-wrap">
        <input
          className="flex-1 min-w-[280px] px-3.5 py-2.5 pl-9 bg-card-rd border border-hairline rounded-md text-[13px]"
          placeholder="Search archived projects · client · service module · year"
          style={{ boxShadow: "0 1px 2px rgba(15,23,41,0.04)" }}
        />
        <button type="button" className="px-3 py-1.5 rounded-md bg-card-rd border border-hairline text-xs font-semibold text-ink-700">Year ▾</button>
        <button type="button" className="px-3 py-1.5 rounded-md bg-card-rd border border-hairline text-xs font-semibold text-ink-700">Client ▾</button>
        <button type="button" className="px-3 py-1.5 rounded-md bg-card-rd border border-hairline text-xs font-semibold text-ink-700">Service ▾</button>
        <button type="button" className="px-3 py-1.5 rounded-md text-xs font-semibold text-white" style={{ background: "var(--color-ink-900)" }}>Recent first</button>
      </div>

      <div className="grid grid-cols-[1.6fr_1fr] gap-6">
        <div>
          {years.map((y) => {
            const yearProjects = byYear.get(y)!;
            const yearRevenue = yearProjects.flatMap((p) => p.estimates.filter((e) => e.isApproved)).reduce((s, e) => s + e.total, 0);
            return (
              <div key={y} className="mb-6">
                <div className="flex items-center gap-3 mb-3 px-1">
                  <span className="font-mono text-lg font-bold text-ink-700 tracking-[-0.01em]">{y}</span>
                  <span className="font-mono text-[11px] text-ink-400 tracking-[0.02em]">// {yearProjects.length} archived · {fmtUSD(yearRevenue)}</span>
                  <span className="flex-1 h-px bg-hairline" />
                </div>
                <div className="bg-card-rd border border-hairline rounded-xl shadow-sm overflow-hidden">
                  {yearProjects.map((p) => {
                    const e = p.estimates.find((x) => x.isApproved);
                    return (
                      <Link
                        key={p.id}
                        href={`/projects/${p.id}`}
                        className="grid items-center gap-3.5 px-4 py-3.5 border-b border-hairline last:border-b-0 hover:bg-[#FCFAF6] transition-colors text-xs"
                        style={{ gridTemplateColumns: "4px 1fr auto auto 24px" }}
                      >
                        <span className="w-1 h-9 rounded-full" style={{ background: "var(--color-s-closed)" }} />
                        <span>
                          <span className="font-mono text-[10px] text-ink-300 tracking-[0.04em]">{p.projectNumber}</span>
                          <div className="text-[13px] font-medium text-ink-900 mt-0.5 tracking-[-0.005em]">{p.title}</div>
                          <div className="text-[11px] text-ink-500 mt-0.5">
                            {p.client.company} · archived {new Date(p.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </div>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full font-mono text-[10px] font-bold tracking-[0.02em]" style={{ border: "1px dashed var(--color-ink-300)", color: "var(--color-ink-400)" }}>
                          // no feedback yet
                        </span>
                        <span className="text-right">
                          <div className="text-[13px] font-semibold text-ink-900 rd-tabular tracking-[-0.01em]">{e ? fmtUSD(e.total) : "—"}</div>
                        </span>
                        <span className="text-ink-300 text-sm text-right">›</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Knowledge insight cards (gray) */}
          <div className="grid grid-cols-2 gap-2.5 mt-6">
            <GrayToolCard icon="🏷" name="Project knowledge tagging" desc="Tag past projects with methodologies, learnings, and reusable insights" />
            <GrayToolCard icon="📑" name="Case study generator" desc="Auto-draft internal case studies from completed projects" />
            <GrayToolCard icon="📚" name="Methodology library" desc="Reusable discussion guides, screeners, and stim materials" />
            <GrayToolCard icon="📈" name="Annual review" desc="Year-end snapshot of revenue, growth, and capability gaps" />
          </div>

          <div
            className="rounded-2xl p-5 mt-4"
            style={{
              background: "linear-gradient(180deg, #F4F1E8 0%, #EFEAE0 100%)",
              border: "1px dashed var(--color-hairline-strong)",
            }}
          >
            <div className="flex items-center justify-between mb-3.5">
              <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase m-0">// ARCHIVE-STAGE TOOLS</p>
              <span className="font-mono text-[9px] font-bold text-white px-2 py-0.5 rounded-full tracking-[0.06em] uppercase" style={{ background: "var(--color-ink-300)" }}>UNDER DEVELOPMENT</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <GrayToolCard icon="💌" name="Feedback request" desc="Email client a short survey when project archives" />
              <GrayToolCard icon="📓" name="Internal learnings" desc="Capture what worked, what didn't, what to do differently" />
              <GrayToolCard icon="🔍" name="Knowledge search" desc="Search across project briefs, deliverables, and notes" />
              <GrayToolCard icon="🪞" name="Reusable insights" desc="Pull recurring quotes and findings into a tagged library" />
              <GrayToolCard icon="🤝" name="Client retention" desc="See repeat-engagement clients; flag dormant ones" />
              <GrayToolCard icon="🌡" name="Capability heatmap" desc="Spot growth and gaps in your service mix over time" />
            </div>
          </div>
        </div>

        <div>
          <div className="bg-card-rd border border-hairline rounded-2xl p-4.5 mb-4 shadow-sm">
            <p className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500 m-0 mb-3.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-s-closed)" }} />
              // HUB STATS · LIVE
            </p>
            {[
              ["All-time revenue", fmtUSD(allTimeRevenue)],
              ["Median project size", fmtUSD(avgProject)],
              ["Largest archived", projects.length ? fmtUSD(Math.max(0, ...projects.flatMap((p) => p.estimates.filter((e) => e.isApproved).map((e) => e.total)))) : "—"],
              ["Repeat clients", `${Array.from(byClient.values()).filter((r) => r.count > 1).length} of ${byClient.size}`],
            ].map(([l, v]) => (
              <div key={l} className="grid grid-cols-[1fr_auto] items-baseline py-2 border-b border-dashed border-hairline last:border-b-0 first:pt-0 last:pb-0 text-xs">
                <span className="font-mono text-[10px] text-ink-500 tracking-[0.04em] uppercase">{l}</span>
                <span className="text-sm font-bold text-ink-900 rd-tabular tracking-[-0.01em]">{v}</span>
              </div>
            ))}
          </div>

          <div className="bg-card-rd border border-hairline rounded-2xl p-4.5 mb-4 shadow-sm">
            <p className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500 m-0 mb-3.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-accent)" }} />
              // TOP CLIENTS · ALL-TIME
            </p>
            {topClients.map((c, i) => (
              <div key={c.name} className="grid items-center gap-2.5 py-2 border-b border-dashed border-hairline last:border-b-0 first:pt-0 last:pb-0 text-xs" style={{ gridTemplateColumns: "24px 1fr auto auto" }}>
                <span className="font-mono text-[11px] font-bold text-ink-300 tracking-[0.04em]">{(i + 1).toString().padStart(2, "0")}</span>
                <span className="text-[13px] text-ink-900 font-medium">{c.name}</span>
                <span className="font-mono text-[11px] text-ink-500">{c.count} proj</span>
                <span className="font-mono text-xs font-semibold text-ink-900 rd-tabular">{fmtUSD(c.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
