// src/components/redesign/hubs/hub-3-completion.tsx
import { Cockpit, Readout, StatusRow } from "@/components/redesign/cockpit";
import { GrayToolCard } from "@/components/redesign/gray-tool-card";
import { HubProjectRow, HubEmptyState, type HubProjectRowData } from "./hub-project-row";
import { ArchiveButton } from "./archive-button";

interface InvoiceLite {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  currency: string;
  dueDate: Date | null;
  paidDate: Date | null;
}

interface ProjectLite extends HubProjectRowData {
  invoices: InvoiceLite[];
  completion: { internalCompleted: boolean; clientAcknowledged: boolean } | null;
}

interface Props {
  projects: ProjectLite[];
}

function fmtUSD(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function HubCompletion({ projects }: Props) {
  const receivable = projects
    .flatMap((p) => p.invoices.filter((i) => i.status === "SENT" || i.status === "OVERDUE"))
    .reduce((s, i) => s + i.total, 0);

  const allPaid = (p: ProjectLite) =>
    p.invoices.length > 0 && p.invoices.every((i) => i.status === "PAID");

  const readyToArchive = projects.filter(allPaid).length;

  return (
    <div>
      <Cockpit
        tag="STAGE_03 · COMPLETION"
        title="Reconciliation & final invoice"
        tagColor="var(--color-s-delivered-fg)"
        context={
          <>
            {"// all "}
            <strong className="text-ink-900 font-bold">{projects.length} PROJECTS</strong>
            {" below have delivered work"}
          </>
        }
      >
        <div className="grid grid-cols-3 gap-0 items-end">
          <Readout label="DELIVERED" value={pad(projects.length)} unit="in this hub" dotColor="var(--color-s-delivered)" />
          <Readout label="RECEIVABLE" value={fmtUSD(receivable)} unit="awaiting payment" />
          <Readout label="READY.ARCHIVE" value={pad(readyToArchive)} unit="all invoices paid" dotColor="var(--color-s-delivered)" muted={readyToArchive === 0} />
        </div>
        <StatusRow
          cells={[
            { label: "STATUS", value: "NOMINAL" },
            { label: "UPDATED", value: new Date().toTimeString().slice(0, 8) },
            { label: "RECEIVABLE", value: fmtUSD(receivable) },
          ]}
        />
      </Cockpit>

      <div className="grid grid-cols-[1.6fr_1fr] gap-6">
        <div>
          {projects.length === 0 ? (
            <HubEmptyState hubLabel="completion" />
          ) : (
            <div className="bg-card-rd border border-hairline rounded-xl shadow-sm overflow-hidden">
              {projects.map((p) => {
                const draftInv = p.invoices.find((i) => i.status === "DRAFT");
                const sentInv = p.invoices.find((i) => i.status === "SENT" || i.status === "OVERDUE");
                return (
                  <HubProjectRow
                    key={p.id}
                    project={p}
                    kind="completion"
                    trailing={
                      <span className="flex gap-1">
                        {draftInv ? (
                          <button
                            type="button"
                            className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.04em] border border-hairline text-ink-700"
                          >
                            Send invoice
                          </button>
                        ) : null}
                        {sentInv ? (
                          <button
                            type="button"
                            className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.04em] border border-hairline text-ink-700"
                          >
                            Mark paid
                          </button>
                        ) : null}
                        {allPaid(p) ? <ArchiveButton projectId={p.id} /> : null}
                      </span>
                    }
                  />
                );
              })}
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
              <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase m-0">{"// COMPLETION-STAGE TOOLS"}</p>
              <span
                className="font-mono text-[9px] font-bold text-white px-2 py-0.5 rounded-full tracking-[0.06em] uppercase"
                style={{ background: "var(--color-ink-300)" }}
              >
                UNDER DEVELOPMENT
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <GrayToolCard icon="🔁" name="Auto-reconciliation" desc="Pre-fill delivered = planned for done deliverables" />
              <GrayToolCard icon="📊" name="Variance reports" desc="Per-project and rolled-up variance by service module" />
              <GrayToolCard icon="🔔" name="Payment reminders" desc="Automatic email cadence to clients with unpaid invoices" />
              <GrayToolCard icon="🏦" name="Bank-feed reconciliation" desc="Match incoming payments to invoices automatically" />
              <GrayToolCard icon="📄" name="Invoice templates" desc="Per-client invoice formats with custom branding" />
              <GrayToolCard icon="💱" name="Currency conversion" desc="USD/CNY auto-rate snapshots for RMB-duplicate invoices" />
            </div>
          </div>
        </div>

        <div>
          <div className="bg-card-rd border border-hairline rounded-2xl p-4.5 mb-4 shadow-sm">
            <p className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500 m-0 mb-3.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-s-delivered)" }} />
              {"// HUB STATS · LIVE"}
            </p>
            {[
              ["Receivable (unpaid)", fmtUSD(receivable)],
              ["Ready to archive", `${readyToArchive} / ${projects.length}`],
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
