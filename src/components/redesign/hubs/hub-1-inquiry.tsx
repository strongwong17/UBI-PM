// src/components/redesign/hubs/hub-1-inquiry.tsx
import { Cockpit, Readout, StatusRow } from "@/components/redesign/cockpit";
import { GrayToolCard } from "@/components/redesign/gray-tool-card";
import { HubProjectRow, HubEmptyState, type HubProjectRowData } from "./hub-project-row";

interface Props {
  projects: HubProjectRowData[];
}

function fmtUSD(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function HubInquiry({ projects }: Props) {
  const pipelineValue = projects
    .flatMap((p) => p.estimates.filter((e) => e.isApproved))
    .reduce((sum, e) => sum + e.total, 0);

  return (
    <div>
      <Cockpit
        tag="STAGE_01 · INQUIRY"
        title="Inquiry & estimation"
        tagColor="var(--color-s-estimating-fg)"
        context={
          <>
            {"// "}
            <strong className="text-ink-900 font-bold">{projects.length} ACTIVE</strong>
            {" · stale estimates auto-archive after 30 days"}
          </>
        }
      >
        <div className="grid grid-cols-2 gap-0 items-end">
          <Readout
            label="ACTIVE"
            value={pad(projects.length)}
            unit="estimating · awaiting client"
            dotColor="var(--color-s-estimating)"
          />
          <Readout
            label="PIPELINE"
            value={fmtUSD(pipelineValue)}
            unit="approved value"
            dotColor="var(--color-s-estimating)"
            muted={pipelineValue === 0}
          />
        </div>

        <StatusRow
          cells={[
            { label: "STATUS", value: "NOMINAL" },
            { label: "UPDATED", value: new Date().toTimeString().slice(0, 8) },
            { label: "PIPELINE", value: fmtUSD(pipelineValue) },
          ]}
        />
      </Cockpit>

      <div className="grid grid-cols-[1.6fr_1fr] gap-6">
        <div>
          {projects.length === 0 ? (
            <HubEmptyState hubLabel="inquiry" />
          ) : (
            <div className="bg-card-rd border border-hairline rounded-xl shadow-sm overflow-hidden hover:border-hairline-strong transition-colors">
              {projects.map((p) => (
                <HubProjectRow key={p.id} project={p} kind="inquiry" />
              ))}
            </div>
          )}

          <div
            className="rounded-2xl p-5 mt-5"
            style={{
              background: "linear-gradient(180deg, #F4F1E8 0%, #EFEAE0 100%)",
              border: "1px dashed var(--color-hairline-strong)",
            }}
          >
            <div className="flex items-center justify-between mb-3.5">
              <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase m-0">
                {"// INQUIRY-STAGE TOOLS"}
              </p>
              <span
                className="font-mono text-[9px] font-bold text-white px-2 py-0.5 rounded-full tracking-[0.06em] uppercase"
                style={{ background: "var(--color-ink-300)" }}
              >
                UNDER DEVELOPMENT
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <GrayToolCard icon="📐" name="Estimate templates" desc="Save reusable phase + line-item templates per service module" />
              <GrayToolCard icon="📤" name="Send tracker" desc="See when clients open estimates, which version, how long they spent" />
              <GrayToolCard icon="⏰" name="Auto follow-up" desc="Schedule a friendly nudge if the client hasn't responded in 7 days" />
              <GrayToolCard icon="💬" name="Proposal comments" desc="Let clients leave inline comments on specific line items" />
              <GrayToolCard icon="🪞" name="Conversion analytics" desc="Which estimate sizes / clients / service modules win most often" />
              <GrayToolCard icon="📋" name="Brief templates" desc="Standard brief structure per inquiry source (WeChat, email, Lark)" />
            </div>
          </div>
        </div>

        <div>
          <div className="bg-card-rd border border-hairline rounded-2xl p-4.5 mb-4 shadow-sm">
            <p className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500 m-0 mb-3.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-s-estimating)" }} />
              {"// HUB STATS · LIVE"}
            </p>
            {[
              ["Pipeline value", fmtUSD(pipelineValue)],
              ["Active projects", `${projects.length}`],
              ["Auto-expire window", "30 days"],
            ].map(([l, v]) => (
              <div
                key={l}
                className="grid grid-cols-[1fr_auto] items-baseline py-2 border-b border-dashed border-hairline last:border-b-0 first:pt-0 last:pb-0 text-xs"
              >
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
