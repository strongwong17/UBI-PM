// src/components/redesign/hubs/hub-3-completion.tsx
import Link from "next/link";
import { Cockpit, Readout, StatusRow } from "@/components/redesign/cockpit";
import { GrayToolCard } from "@/components/redesign/gray-tool-card";

interface InvoiceLite {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  currency: string;
  dueDate: Date | null;
  paidDate: Date | null;
}

interface ProjectLite {
  id: string;
  projectNumber: string;
  title: string;
  status: string;
  updatedAt: Date;
  client: { company: string };
  estimates: {
    id: string;
    isApproved: boolean;
    total: number;
    currency: string;
    phases: { lineItems: { quantity: number; unitPrice: number; deliveredQuantity: number | null }[] }[];
  }[];
  invoices: InvoiceLite[];
  completion: { internalCompleted: boolean; clientAcknowledged: boolean } | null;
}

interface Props { projects: ProjectLite[]; }

function fmtUSD(n: number) { return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`; }
function pad(n: number) { return n.toString().padStart(2, "0"); }

function projectVariance(p: ProjectLite): { delivered: number; planned: number; delta: number; pct: number; pending: boolean } {
  const approved = p.estimates.find((e) => e.isApproved);
  if (!approved) return { delivered: 0, planned: 0, delta: 0, pct: 0, pending: true };
  let planned = 0;
  let delivered = 0;
  let pending = false;
  for (const phase of approved.phases) {
    for (const li of phase.lineItems) {
      planned += li.quantity * li.unitPrice;
      if (li.deliveredQuantity == null) pending = true;
      delivered += (li.deliveredQuantity ?? li.quantity) * li.unitPrice;
    }
  }
  const delta = delivered - planned;
  const pct = planned ? (delta / planned) * 100 : 0;
  return { delivered, planned, delta, pct, pending };
}

function classify(p: ProjectLite): "reconcile" | "awaiting-pay" | "paid" {
  const sentInv = p.invoices.find((i) => i.status === "SENT" || i.status === "OVERDUE");
  const paidInv = p.invoices.find((i) => i.status === "PAID");
  if (paidInv) return "paid";
  if (sentInv) return "awaiting-pay";
  return "reconcile";
}

export function HubCompletion({ projects }: Props) {
  const reconcile = projects.filter((p) => classify(p) === "reconcile");
  const awaitingPay = projects.filter((p) => classify(p) === "awaiting-pay");
  const paid = projects.filter((p) => classify(p) === "paid");

  const allVariance = projects.map(projectVariance).filter((v) => !v.pending);
  const avgVariancePct =
    allVariance.length === 0
      ? 0
      : allVariance.reduce((s, v) => s + v.pct, 0) / allVariance.length;
  const deliveredValue = allVariance.reduce((s, v) => s + v.delivered, 0);
  const toInvoice = projects
    .filter((p) => classify(p) === "reconcile")
    .reduce((s, p) => s + projectVariance(p).delivered, 0);
  const receivable = projects
    .flatMap((p) => p.invoices.filter((i) => i.status === "SENT" || i.status === "OVERDUE"))
    .reduce((s, i) => s + i.total, 0);

  return (
    <div>
      <Cockpit
        tag="STAGE_03 · COMPLETION"
        title="Reconciliation & final invoice"
        tagColor="var(--color-s-delivered-fg)"
        context={
          <>
            {"// all "}<strong className="text-ink-900 font-bold">{projects.length} PROJECTS</strong> below have delivered work
          </>
        }
      >
        <div className="grid grid-cols-5 gap-0 items-end">
          <Readout label="ACTIVE" value={pad(projects.length)} unit="in this hub" dotColor="var(--color-s-delivered)" />
          <Readout label="RECONCILE" value={pad(reconcile.length)} unit="actuals · sign-off" dotColor="var(--color-warn)" blink={reconcile.length > 0} muted={reconcile.length === 0} />
          <Readout label="AWAITING PAY" value={pad(awaitingPay.length)} unit="invoice sent" dotColor="#EC4899" muted={awaitingPay.length === 0} />
          <Readout label="PAID · ARCHIVE" value={pad(paid.length)} unit="ready to advance" dotColor="var(--color-s-delivered)" muted={paid.length === 0} />
          <Readout
            label="VARIANCE"
            value={
              <span style={{ color: avgVariancePct < 0 ? "var(--color-var-under)" : "var(--color-ink-900)" }}>
                {avgVariancePct >= 0 ? "+" : ""}
                {avgVariancePct.toFixed(1)}
                <span className="text-[18px] font-semibold">%</span>
              </span>
            }
            unit="avg"
          />
        </div>
        <StatusRow
          cells={[
            { label: "STATUS", value: "NOMINAL" },
            { label: "UPDATED", value: new Date().toTimeString().slice(0, 8) },
            { label: "TO.INVOICE", value: fmtUSD(toInvoice) },
            { label: "RECEIVABLE", value: fmtUSD(receivable) },
            { label: "DELIVERED.VALUE", value: fmtUSD(deliveredValue) },
            { label: "AVG.VARIANCE", value: `${avgVariancePct >= 0 ? "+" : ""}${avgVariancePct.toFixed(1)}%`, under: avgVariancePct < 0 },
          ]}
        />
      </Cockpit>

      <div className="grid grid-cols-[1.6fr_1fr] gap-6">
        <div>
          <CompletionGroup label="// RECONCILE ACTUALS & SIGN-OFF" color="var(--color-warn-fg)" dotColor="var(--color-warn)" projects={reconcile} variant="reconcile" />
          <CompletionGroup label="// INVOICE SENT · AWAITING PAYMENT" color="#9F1239" dotColor="#EC4899" projects={awaitingPay} variant="awaiting" />
          <CompletionGroup label="// PAID · READY FOR HUB 4" color="var(--color-s-delivered-fg)" dotColor="var(--color-s-delivered)" projects={paid} variant="paid" />

          <div
            className="rounded-2xl p-5 mt-5"
            style={{
              background: "linear-gradient(180deg, #F4F1E8 0%, #EFEAE0 100%)",
              border: "1px dashed var(--color-hairline-strong)",
            }}
          >
            <div className="flex items-center justify-between mb-3.5">
              <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase m-0">{"// COMPLETION-STAGE TOOLS"}</p>
              <span className="font-mono text-[9px] font-bold text-white px-2 py-0.5 rounded-full tracking-[0.06em] uppercase" style={{ background: "var(--color-ink-300)" }}>
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
              ["Delivered value", fmtUSD(deliveredValue)],
              ["Pending invoice", fmtUSD(toInvoice)],
              ["Receivable (unpaid)", fmtUSD(receivable)],
              ["Avg variance", `${avgVariancePct >= 0 ? "+" : ""}${avgVariancePct.toFixed(1)}%`],
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

function CompletionGroup({
  label,
  color,
  dotColor,
  projects,
  variant,
}: {
  label: string;
  color: string;
  dotColor: string;
  projects: ProjectLite[];
  variant: "reconcile" | "awaiting" | "paid";
}) {
  return (
    <div className="mb-4.5">
      <p className="font-mono text-[10px] font-bold tracking-[0.04em] uppercase mb-2 ml-1 flex items-center gap-1.5" style={{ color }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: dotColor }} />
        {label}
        <span className="text-ink-300 ml-1 font-semibold">· {projects.length}</span>
      </p>
      {projects.length === 0 ? (
        <div className="rounded-xl p-4.5 text-center font-mono text-[11px] text-ink-400 tracking-[0.04em]" style={{ background: "#FAFAF6", border: "1px dashed var(--color-hairline-strong)" }}>
          {"// STDBY"}
        </div>
      ) : (
        <div className="bg-card-rd border border-hairline rounded-xl shadow-sm overflow-hidden">
          {projects.map((p) => {
            const v = projectVariance(p);
            const draftInv = p.invoices.find((i) => i.status === "DRAFT");
            const sentInv = p.invoices.find((i) => i.status === "SENT" || i.status === "OVERDUE");
            const paidInv = p.invoices.find((i) => i.status === "PAID");

            return (
              <div
                key={p.id}
                className="grid items-center gap-3.5 px-4 py-3.5 border-b border-hairline last:border-b-0 hover:bg-[#FCFAF6] transition-colors text-xs"
                style={{ gridTemplateColumns: "4px 1fr auto auto auto 24px" }}
              >
                <span className="w-1 h-9 rounded-full" style={{ background: dotColor }} />
                <Link href={`/projects/${p.id}`} className="block">
                  <span className="font-mono text-[10px] text-ink-300 tracking-[0.04em]">{p.projectNumber}</span>
                  <div className="text-[13px] font-medium text-ink-900 mt-0.5 tracking-[-0.005em]">{p.title}</div>
                  <div className="text-[11px] text-ink-500">{p.client.company} · delivered</div>
                </Link>
                <VarianceChip variance={v} />
                <InvoicePill invoice={draftInv ?? sentInv ?? paidInv} />
                <Actions variant={variant} project={p} draftInv={draftInv} sentInv={sentInv} paidInv={paidInv} />
                <span className="text-ink-300 text-sm text-right">›</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VarianceChip({ variance: v }: { variance: ReturnType<typeof projectVariance> }) {
  if (v.pending) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-bold tracking-[0.02em]" style={{ border: "1px dashed var(--color-ink-300)", color: "var(--color-ink-400)" }}>
        {"// pending"}
      </span>
    );
  }
  if (Math.abs(v.delta) < 1) {
    return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full font-mono text-[10px] font-bold tracking-[0.02em]" style={{ background: "var(--color-canvas-cool)", color: "var(--color-ink-500)" }}>on plan</span>;
  }
  const isUnder = v.delta < 0;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full font-mono text-[10px] font-bold tracking-[0.02em]"
      style={{
        background: isUnder ? "rgba(5, 150, 105, 0.10)" : "rgba(220, 38, 38, 0.10)",
        color: isUnder ? "var(--color-var-under)" : "var(--color-var-over)",
      }}
    >
      {isUnder ? "" : "+"}${Math.round(Math.abs(v.delta)).toLocaleString()} / {v.pct.toFixed(1)}%
    </span>
  );
}

function InvoicePill({ invoice }: { invoice?: InvoiceLite }) {
  if (!invoice) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold" style={{ background: "var(--color-canvas-cool)", color: "var(--color-ink-400)", border: "1px dashed var(--color-ink-300)" }}>
        no invoice yet
      </span>
    );
  }
  const map: Record<string, { bg: string; fg: string; dot: string; label: string }> = {
    DRAFT:   { bg: "#EFF1F5",                fg: "#475569",                  dot: "#94A3B8", label: "Draft" },
    SENT:    { bg: "#FCE7F3",                fg: "#9F1239",                  dot: "#EC4899", label: "Sent" },
    OVERDUE: { bg: "var(--color-warn-bg)",   fg: "var(--color-warn-fg)",     dot: "var(--color-warn)", label: "Overdue" },
    PAID:    { bg: "var(--color-s-delivered-bg)", fg: "var(--color-s-delivered-fg)", dot: "var(--color-s-delivered)", label: "Paid" },
  };
  const t = map[invoice.status] ?? map.DRAFT;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold" style={{ background: t.bg, color: t.fg }}>
      <span className="w-1 h-1 rounded-full" style={{ background: t.dot }} />
      {t.label}
    </span>
  );
}

function Actions({
  variant,
  project,
  draftInv,
  sentInv,
}: {
  variant: "reconcile" | "awaiting" | "paid";
  project: ProjectLite;
  draftInv?: InvoiceLite;
  sentInv?: InvoiceLite;
  paidInv?: InvoiceLite;
}) {
  if (variant === "reconcile" && !draftInv) {
    return (
      <Link
        href={`/projects/${project.id}?tab=confirm-actuals`}
        className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.04em] text-white"
        style={{ background: "var(--color-ink-900)" }}
      >
        Confirm actuals
      </Link>
    );
  }
  if (variant === "reconcile" && draftInv) {
    return (
      <Link
        href={`/invoices/${draftInv.id}/send`}
        className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.04em] text-white"
        style={{ background: "var(--color-ink-900)" }}
      >
        Send invoice
      </Link>
    );
  }
  if (variant === "awaiting" && sentInv) {
    return (
      <div className="flex gap-1">
        <button
          type="button"
          className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.04em] border border-hairline text-ink-700"
        >
          Remind
        </button>
        <button
          type="button"
          className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.04em] text-white"
          style={{ background: "var(--color-s-delivered)" }}
        >
          Mark paid
        </button>
      </div>
    );
  }
  if (variant === "paid") {
    return (
      <button
        type="button"
        className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.04em] text-white"
        style={{ background: "var(--color-ink-900)" }}
      >
        Archive →
      </button>
    );
  }
  return null;
}
