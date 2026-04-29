// src/components/redesign/hubs/hub-2-in-progress.tsx
import Link from "next/link";
import { Cockpit, Readout, StatusRow } from "@/components/redesign/cockpit";
import { GrayToolCard } from "@/components/redesign/gray-tool-card";
import { phaseTokens } from "@/lib/redesign-tokens";
import { currencySymbol } from "@/lib/currency";

interface ProjectLite {
  id: string;
  projectNumber: string;
  title: string;
  status: string;
  executionPhase: string | null;
  startDate: Date | null;
  client: { company: string };
  estimates: { isApproved: boolean; total: number; currency: string }[];
}

interface Props { projects: ProjectLite[]; }

function fmtUSD(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function pad(n: number) { return n.toString().padStart(2, "0"); }

export function HubInProgress({ projects }: Props) {
  const byPhase = (phase: string) => projects.filter((p) => p.executionPhase === phase);
  const recruit = byPhase("RECRUITMENT");
  const field = byPhase("FIELDWORK");
  const analyze = byPhase("ANALYSIS");
  const report = byPhase("REPORTING");

  const activeValue = projects
    .flatMap((p) => p.estimates.filter((e) => e.isApproved))
    .reduce((s, e) => s + e.total, 0);

  const oldest = projects.reduce(
    (max, p) =>
      p.startDate
        ? // eslint-disable-next-line react-hooks/purity
          Math.max(max, Math.floor((Date.now() - p.startDate.getTime()) / 86_400_000))
        : max,
    0,
  );
  const newest = projects.reduce(
    (min, p) =>
      p.startDate
        ? // eslint-disable-next-line react-hooks/purity
          Math.min(min, Math.floor((Date.now() - p.startDate.getTime()) / 86_400_000))
        : min,
    Number.POSITIVE_INFINITY,
  );

  return (
    <div>
      <Cockpit
        tag="STAGE_02 · IN PROGRESS"
        title="Execution & delivery"
        tagColor="var(--color-s-in-progress-fg)"
        context={
          <>
            {"// all "}<strong className="text-ink-900 font-bold">{projects.length} PROJECTS</strong> below are actively being executed
          </>
        }
      >
        <div className="grid grid-cols-5 gap-0 items-end">
          <Readout label="ACTIVE" value={pad(projects.length)} unit="in this hub" dotColor="var(--color-s-in-progress)" />
          <Readout label="RECRUITMENT" value={pad(recruit.length)} unit="recruiting panel" dotColor="var(--color-p-recruit)" muted={recruit.length === 0} />
          <Readout label="FIELDWORK" value={pad(field.length)} unit="in field" dotColor="var(--color-p-field)" muted={field.length === 0} />
          <Readout label="ANALYSIS" value={pad(analyze.length)} unit="analyzing" dotColor="var(--color-p-analyze)" muted={analyze.length === 0} />
          <Readout label="REPORTING" value={pad(report.length)} unit="writing up" dotColor="var(--color-p-report)" muted={report.length === 0} />
        </div>
        <StatusRow
          cells={[
            { label: "STATUS", value: "NOMINAL" },
            { label: "UPDATED", value: new Date().toTimeString().slice(0, 8) },
            { label: "ACTIVE.VALUE", value: fmtUSD(activeValue) },
            { label: "OLDEST.START", value: oldest > 0 ? `${oldest}d ago` : "—" },
            { label: "NEWEST.START", value: Number.isFinite(newest) ? `${newest}d ago` : "—" },
          ]}
        />
      </Cockpit>

      <div className="grid grid-cols-[1.6fr_1fr] gap-6">
        <div>
          {[
            { phase: "RECRUITMENT", projects: recruit, label: "// RECRUITMENT" },
            { phase: "FIELDWORK", projects: field, label: "// FIELDWORK" },
            { phase: "ANALYSIS", projects: analyze, label: "// ANALYSIS" },
            { phase: "REPORTING", projects: report, label: "// REPORTING" },
          ].map((g) => (
            <PhaseGroup key={g.phase} phase={g.phase} label={g.label} projects={g.projects} />
          ))}

          <div
            className="rounded-2xl p-5 mt-5"
            style={{
              background: "linear-gradient(180deg, #F4F1E8 0%, #EFEAE0 100%)",
              border: "1px dashed var(--color-hairline-strong)",
            }}
          >
            <div className="flex items-center justify-between mb-3.5">
              <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase m-0">{"// IN-PROGRESS TOOLS"}</p>
              <span
                className="font-mono text-[9px] font-bold text-white px-2 py-0.5 rounded-full tracking-[0.06em] uppercase"
                style={{ background: "var(--color-ink-300)" }}
              >
                UNDER DEVELOPMENT
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <GrayToolCard icon="👥" name="Team management" desc="Assign internal team + external vendors per project" />
              <GrayToolCard icon="🤝" name="Vendor directory" desc="Reusable vendor profiles with rate cards and past projects" />
              <GrayToolCard icon="✅" name="Deliverable tracker" desc="Per-line deliverables, owner, status, due date — auto-built from estimate" />
              <GrayToolCard icon="⏱" name="Time logging" desc="Track hours per person per project for billing & capacity" />
              <GrayToolCard icon="📥" name="Vendor invoice review" desc="Receive and approve vendor invoices linked to your line items" />
              <GrayToolCard icon="🗓" name="Phase deadlines" desc="Set and track phase-level deadlines; alert on slippage" />
            </div>
          </div>
        </div>

        <div>
          <div className="bg-card-rd border border-hairline rounded-2xl p-4.5 mb-4 shadow-sm">
            <p className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500 m-0 mb-3.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-s-in-progress)" }} />
              {"// HUB STATS · LIVE"}
            </p>
            {[
              ["Active value", fmtUSD(activeValue)],
              ["Avg project size", projects.length ? fmtUSD(activeValue / projects.length) : "—"],
              ["Largest in-flight", fmtUSD(Math.max(0, ...projects.flatMap((p) => p.estimates.filter((e) => e.isApproved).map((e) => e.total))))],
            ].map(([l, v]) => (
              <div key={l} className="grid grid-cols-[1fr_auto] items-baseline py-2 border-b border-dashed border-hairline last:border-b-0 first:pt-0 last:pb-0 text-xs">
                <span className="font-mono text-[10px] text-ink-500 tracking-[0.04em] uppercase">{l}</span>
                <span className="text-sm font-bold text-ink-900 rd-tabular tracking-[-0.01em]">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PhaseGroup({
  phase,
  label,
  projects,
}: {
  phase: string;
  label: string;
  projects: ProjectLite[];
}) {
  const t = phaseTokens(phase);
  const phaseOrder = ["RECRUITMENT", "FIELDWORK", "ANALYSIS", "REPORTING"];
  const currentIdx = phaseOrder.indexOf(phase);

  return (
    <div className="mb-4.5">
      <p
        className="font-mono text-[10px] font-bold tracking-[0.04em] uppercase mb-2 ml-1 flex items-center gap-1.5"
        style={{ color: t.fg }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.dot }} />
        {label}
        <span className="text-ink-300 ml-1 font-semibold">· {projects.length}</span>
      </p>
      {projects.length === 0 ? (
        <div
          className="rounded-xl p-4.5 text-center font-mono text-[11px] text-ink-400 tracking-[0.04em]"
          style={{ background: "#FAFAF6", border: "1px dashed var(--color-hairline-strong)" }}
        >
          {"// STDBY · NO PROJECTS IN "}{phase}
        </div>
      ) : (
        <div className="bg-card-rd border border-hairline rounded-xl shadow-sm overflow-hidden">
          {projects.map((p) => {
            const days = p.startDate
              ? // eslint-disable-next-line react-hooks/purity
                Math.floor((Date.now() - p.startDate.getTime()) / 86_400_000)
              : null;
            const e = p.estimates.find((x) => x.isApproved);
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="grid items-center gap-3.5 px-4 py-3.5 border-b border-hairline last:border-b-0 hover:bg-[#FCFAF6] transition-colors text-xs"
                style={{ gridTemplateColumns: "4px 1fr 130px auto 24px" }}
              >
                <span className="w-1 h-9 rounded-full" style={{ background: t.dot }} />
                <span>
                  <span className="font-mono text-[10px] text-ink-300 tracking-[0.04em]">{p.projectNumber}</span>
                  <div className="text-[13px] font-medium text-ink-900 mt-0.5 tracking-[-0.005em]">{p.title}</div>
                  <div className="text-[11px] text-ink-500">{p.client.company}</div>
                </span>
                <span className="flex gap-1 items-center">
                  {phaseOrder.map((ph, i) => (
                    <span
                      key={ph}
                      className="w-3.5 h-1.5 rounded-full"
                      style={{
                        background:
                          i < currentIdx
                            ? "var(--color-ink-300)"
                            : i === currentIdx
                              ? t.dot
                              : "var(--color-hairline)",
                      }}
                    />
                  ))}
                  <span
                    className="font-mono text-[10px] ml-1.5 tracking-[0.04em] uppercase font-semibold"
                    style={{ color: t.fg }}
                  >
                    {phase.slice(0, 6)}
                  </span>
                </span>
                <span className="text-right">
                  <div className="text-xs text-ink-700 font-medium rd-tabular">
                    {e ? `${currencySymbol(e.currency)}${e.total.toLocaleString()}` : "—"}
                  </div>
                  <div className="font-mono text-[10px] text-ink-400 mt-0.5 tracking-[0.02em]">
                    {days != null ? `started ${days}d ago` : "no start date"}
                  </div>
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
