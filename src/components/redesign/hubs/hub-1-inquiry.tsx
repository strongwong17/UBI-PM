// src/components/redesign/hubs/hub-1-inquiry.tsx
import Link from "next/link";
import { Cockpit, Readout, StatusRow } from "@/components/redesign/cockpit";
import { GrayToolCard } from "@/components/redesign/gray-tool-card";
import { currencySymbol } from "@/lib/currency";

interface ProjectLite {
  id: string;
  projectNumber: string;
  title: string;
  status: string;
  updatedAt: Date;
  client: { company: string };
  estimates: { isApproved: boolean; total: number; currency: string; version: number; updatedAt: Date }[];
}

interface Props {
  projects: ProjectLite[];
  staleProjects: ProjectLite[];
}

const STALE_DAYS = 30;

function fmtUSD(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function HubInquiry({ projects, staleProjects }: Props) {
  const briefed = projects.filter((p) => p.status === "BRIEFED");
  const estimating = projects.filter((p) => p.status === "ESTIMATING");
  const sent = estimating.filter((p) => !staleProjects.some((s) => s.id === p.id));
  const approved = projects.filter((p) => p.status === "APPROVED");
  const drafts = projects.filter((p) => p.status === "NEW");

  const pipelineValue = projects
    .flatMap((p) => p.estimates.filter((e) => e.isApproved))
    .reduce((sum, e) => sum + e.total, 0);
  const stalePipelineValue = staleProjects
    .flatMap((p) => p.estimates.filter((e) => e.isApproved))
    .reduce((sum, e) => sum + e.total, 0);
  const oldestStale = staleProjects.reduce(
    (max, p) =>
      // eslint-disable-next-line react-hooks/purity
      Math.max(max, Math.floor((Date.now() - p.updatedAt.getTime()) / 86_400_000)),
    0,
  );

  return (
    <div>
      <Cockpit
        tag="STAGE_01 · INQUIRY"
        title="Inquiry & estimation"
        tagColor="var(--color-s-estimating-fg)"
        context={
          <>
            {"// "}<strong className="text-ink-900 font-bold">{projects.length - drafts.length} ACTIVE</strong>
            {drafts.length > 0 ? (
              <Link
                href="/projects?status=NEW"
                className="text-s-estimating-fg tracking-[0.04em] hover:underline"
              >
                {"// "}{drafts.length} drafts pending brief →
              </Link>
            ) : null}
          </>
        }
      >
        <div className="grid grid-cols-5 gap-0 items-end">
          <Readout
            label="ACTIVE"
            value={pad(projects.length - drafts.length)}
            unit="in this hub"
            dotColor="var(--color-s-estimating)"
          />
          <Readout
            label="BRIEFED"
            value={pad(briefed.length)}
            unit="to estimate"
            dotColor="var(--color-s-briefed)"
          />
          <Readout
            label="SENT"
            value={pad(estimating.length)}
            unit="awaiting client"
            dotColor="var(--color-s-estimating)"
          />
          <Readout
            label="APPROVED"
            value={pad(approved.length)}
            unit="ready to advance"
            dotColor="var(--color-s-approved)"
            muted={approved.length === 0}
          />
          <Readout
            label="STALE"
            value={pad(staleProjects.length)}
            unit={`${STALE_DAYS}d+ no movement`}
            dotColor="var(--color-warn)"
            blink={staleProjects.length > 0}
            warn={staleProjects.length > 0}
          />
        </div>

        <StatusRow
          cells={[
            { label: "STATUS", value: "NOMINAL" },
            { label: "UPDATED", value: new Date().toTimeString().slice(0, 8) },
            { label: "OLDEST.STALE", value: `${oldestStale}d` },
            { label: "PIPELINE", value: fmtUSD(pipelineValue) },
          ]}
          trailing={
            staleProjects.length > 0 ? (
              <span className="text-warn-fg font-bold tracking-[0.04em]">▶ REVIEW STALE BATCH</span>
            ) : null
          }
        />
      </Cockpit>

      <div className="grid grid-cols-[1.6fr_1fr] gap-6">
        <div>
          <SubGroup
            label="// ESTIMATION SENT · AWAITING CLIENT"
            count={sent.length}
            color="var(--color-s-estimating-fg)"
            dotColor="var(--color-s-estimating)"
            projects={sent}
            metaFn={(p) => {
              const e = p.estimates.find((x) => x.isApproved) ?? p.estimates[0];
              const days = e ? Math.floor((Date.now() - e.updatedAt.getTime()) / 86_400_000) : 0;
              return {
                main: e ? `${currencySymbol(e.currency)}${e.total.toLocaleString()}` : "—",
                sub: e ? `v${e.version} · sent ${days}d ago` : "no estimate",
              };
            }}
          />

          <SubGroup
            label="// PROJECT BRIEFED · TO ESTIMATE"
            count={briefed.length}
            color="var(--color-s-briefed-fg)"
            dotColor="var(--color-s-briefed)"
            projects={briefed}
            metaFn={(p) => ({
              main: "no estimate",
              sub: `briefed ${new Date(p.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
            })}
          />

          <SubGroup
            label="// APPROVED · READY FOR NEXT HUB"
            count={approved.length}
            color="var(--color-s-approved-fg)"
            dotColor="var(--color-s-approved)"
            projects={approved}
            emptyText="// STDBY · NO PROJECTS APPROVED YET. ONCE A CLIENT APPROVES, THE PROJECT MOVES TO HUB 2."
            metaFn={(p) => {
              const e = p.estimates.find((x) => x.isApproved);
              return {
                main: e ? `${currencySymbol(e.currency)}${e.total.toLocaleString()}` : "—",
                sub: "approved",
              };
            }}
          />

          <ToolsArea
            heading="// INQUIRY-STAGE TOOLS"
            tools={[
              { icon: "📐", name: "Estimate templates", desc: "Save reusable phase + line-item templates per service module" },
              { icon: "📤", name: "Send tracker", desc: "See when clients open estimates, which version, how long they spent" },
              { icon: "⏰", name: "Auto follow-up", desc: "Schedule a friendly nudge if the client hasn't responded in 7 days" },
              { icon: "💬", name: "Proposal comments", desc: "Let clients leave inline comments on specific line items" },
              { icon: "🪞", name: "Conversion analytics", desc: "Which estimate sizes / clients / service modules win most often" },
              { icon: "📋", name: "Brief templates", desc: "Standard brief structure per inquiry source (WeChat, email, Lark)" },
            ]}
          />
        </div>

        <div>
          {staleProjects.length > 0 ? (
            <div
              className="rounded-2xl p-4 mb-4 border"
              style={{
                background: "linear-gradient(180deg, #FCEEDC 0%, #FCE5C8 100%)",
                borderColor: "rgba(201, 117, 32, 0.2)",
              }}
            >
              <p className="font-mono text-[10px] font-bold text-warn-fg tracking-[0.06em] uppercase">⚠ STALE BATCH PENDING</p>
              <div className="text-[22px] font-extrabold text-warn-fg tracking-[-0.02em] my-2 rd-tabular leading-none">
                {staleProjects.length}
              </div>
              <p className="text-[11px] text-warn-fg/80 mb-3">
                {fmtUSD(stalePipelineValue)} in pipeline · oldest {oldestStale}d · most won&apos;t convert
              </p>
              <button
                type="button"
                className="bg-white text-warn-fg px-3 py-1.5 rounded-md border border-warn font-semibold text-[11px]"
              >
                Review &amp; archive →
              </button>
            </div>
          ) : null}

          <RailStats
            heading="// HUB STATS · LIVE"
            dotColor="var(--color-s-estimating)"
            rows={[
              ["Pipeline value", fmtUSD(pipelineValue)],
              ["Awaiting (active)", `${sent.length} project${sent.length === 1 ? "" : "s"}`],
              ["Stale total", `${staleProjects.length} · ${oldestStale}d max`],
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function SubGroup({
  label,
  count,
  color,
  dotColor,
  projects,
  metaFn,
  emptyText,
}: {
  label: string;
  count: number;
  color: string;
  dotColor: string;
  projects: ProjectLite[];
  metaFn: (p: ProjectLite) => { main: string; sub: string };
  emptyText?: string;
}) {
  return (
    <div className="mb-4">
      <p
        className="font-mono text-[10px] font-bold tracking-[0.04em] uppercase mb-2 ml-1 flex items-center gap-1.5"
        style={{ color }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: dotColor }} />
        {label}
        <span className="text-ink-300 ml-1 font-semibold">· {count}</span>
      </p>
      {projects.length === 0 ? (
        <div
          className="rounded-xl p-4.5 text-center font-mono text-[11px] text-ink-400 tracking-[0.04em]"
          style={{ background: "#FAFAF6", border: "1px dashed var(--color-hairline-strong)" }}
        >
          {emptyText ?? "// EMPTY"}
        </div>
      ) : (
        <div className="bg-card-rd border border-hairline rounded-xl shadow-sm overflow-hidden hover:border-hairline-strong transition-colors">
          {projects.map((p) => {
            const m = metaFn(p);
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="grid items-center gap-3.5 px-4 py-3 border-b border-hairline last:border-b-0 hover:bg-[#FCFAF6] transition-colors text-xs"
                style={{ gridTemplateColumns: "4px 1fr auto 24px" }}
              >
                <span className="w-1 h-8 rounded-full" style={{ background: dotColor }} />
                <span>
                  <span className="font-mono text-[10px] text-ink-300 tracking-[0.04em]">{p.projectNumber}</span>
                  <div className="text-[13px] font-medium text-ink-900 mt-0.5 tracking-[-0.005em]">{p.title}</div>
                  <div className="text-[11px] text-ink-500">{p.client.company}</div>
                </span>
                <span className="text-right">
                  <div className="text-xs text-ink-700 font-medium rd-tabular">{m.main}</div>
                  <div className="font-mono text-[10px] text-ink-400 mt-0.5 tracking-[0.02em]">{m.sub}</div>
                </span>
                <span className="text-ink-300 text-sm text-right">›</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ToolsArea({ heading, tools }: { heading: string; tools: { icon: string; name: string; desc: string }[] }) {
  return (
    <div
      className="rounded-2xl p-5 mt-5"
      style={{
        background: "linear-gradient(180deg, #F4F1E8 0%, #EFEAE0 100%)",
        border: "1px dashed var(--color-hairline-strong)",
      }}
    >
      <div className="flex items-center justify-between mb-3.5">
        <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase m-0">{heading}</p>
        <span
          className="font-mono text-[9px] font-bold text-white px-2 py-0.5 rounded-full tracking-[0.06em] uppercase"
          style={{ background: "var(--color-ink-300)" }}
        >
          UNDER DEVELOPMENT
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {tools.map((t) => (
          <GrayToolCard key={t.name} icon={t.icon} name={t.name} desc={t.desc} />
        ))}
      </div>
    </div>
  );
}

function RailStats({
  heading,
  dotColor,
  rows,
}: {
  heading: string;
  dotColor: string;
  rows: [string, string][];
}) {
  return (
    <div className="bg-card-rd border border-hairline rounded-2xl p-4.5 mb-4 shadow-sm">
      <p className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500 m-0 mb-3.5 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: dotColor }} />
        {heading}
      </p>
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="grid grid-cols-[1fr_auto] items-baseline py-2 border-b border-dashed border-hairline last:border-b-0 first:pt-0 last:pb-0 text-xs"
        >
          <span className="font-mono text-[10px] text-ink-500 tracking-[0.04em] uppercase">{label}</span>
          <span className="text-sm font-bold text-ink-900 rd-tabular tracking-[-0.01em]">{value}</span>
        </div>
      ))}
    </div>
  );
}
