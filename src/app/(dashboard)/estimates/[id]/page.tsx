import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StatusPill } from "@/components/redesign/status-pill";
import { ArrowLeft, Edit, Download, FileSpreadsheet } from "lucide-react";
import { EstimateStatusChanger } from "@/components/estimates/estimate-status-changer";
import { EstimateDuplicateButton } from "@/components/estimates/estimate-duplicate-button";
import { EstimateApproveButton } from "@/components/estimates/estimate-approve-button";
import { EstimateDeleteButton } from "@/components/estimates/estimate-delete-button";
import { CreateRmbEstimateButton } from "@/components/estimates/create-rmb-estimate-button";
import { currencySymbol } from "@/lib/currency";

export default async function EstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const estimate = await prisma.estimate.findUnique({
    where: { id },
    include: {
      project: { include: { client: true } },
      createdBy: { select: { name: true } },
      phases: {
        include: { lineItems: { orderBy: { sortOrder: "asc" } } },
        orderBy: { sortOrder: "asc" },
      },
      rmbDuplicate: { select: { id: true, estimateNumber: true } },
      parentEstimate: { select: { id: true, estimateNumber: true } },
    },
  });

  if (!estimate) notFound();

  const symbol = currencySymbol(estimate.currency);

  const subtotal = estimate.phases.reduce(
    (sum, phase) =>
      sum + phase.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0),
    0
  );
  const taxAmount = subtotal * (estimate.taxRate / 100);
  const total = subtotal + taxAmount - estimate.discount;

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtMoney = (n: number) =>
    `${symbol}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/projects/${estimate.project.id}?tab=estimates`}
          className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900 mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to project
        </Link>

        <div
          className="flex items-start justify-between gap-4 flex-wrap pb-[18px]"
          style={{ borderBottom: "1px solid var(--color-hairline)" }}
        >
          <div>
            <div className="font-mono text-[11px] text-ink-500 tracking-[0.04em] mb-1.5">
              <Link
                href={`/clients/${estimate.project.client.id}`}
                className="hover:text-accent-rd"
              >
                {estimate.project.client.company}
              </Link>
              {" · "}
              <Link
                href={`/projects/${estimate.project.id}`}
                className="hover:text-accent-rd"
              >
                {estimate.project.title}
              </Link>
              {" · "}
              <span className="text-ink-700">{estimate.estimateNumber}</span>
            </div>
            <h1 className="text-[24px] font-bold tracking-[-0.025em] text-ink-900 m-0 mb-2">
              {estimate.title}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusPill status={estimate.status} />
              <span className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
                v.{estimate.version}
              </span>
              {estimate.label && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-[0.06em] uppercase"
                  style={{
                    background: "var(--color-canvas-cool)",
                    color: "var(--color-ink-700)",
                    border: "1px solid var(--color-hairline-strong)",
                  }}
                >
                  {estimate.label}
                </span>
              )}
              {estimate.isApproved && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-[0.06em] uppercase"
                  style={{
                    background: "var(--color-s-approved-bg)",
                    color: "var(--color-s-approved-fg)",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "var(--color-s-approved)" }}
                  />
                  Approved
                </span>
              )}
              {estimate.parentEstimateId && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-[0.06em] uppercase"
                  style={{
                    background: "var(--color-canvas-cool)",
                    color: "var(--color-ink-700)",
                    border: "1px solid var(--color-hairline-strong)",
                  }}
                >
                  RMB
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <EstimateStatusChanger estimateId={estimate.id} currentStatus={estimate.status} />
            <EstimateApproveButton
              estimateId={estimate.id}
              isApproved={estimate.isApproved}
              version={estimate.version}
            />
            <EstimateDuplicateButton estimateId={estimate.id} />
            {!estimate.parentEstimateId && (
              <CreateRmbEstimateButton
                estimateId={estimate.id}
                estimateNumber={estimate.estimateNumber}
                hasRmbDuplicate={!!estimate.rmbDuplicate}
              />
            )}
            <a
              href={`/api/estimates/${estimate.id}/pdf`}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd"
              style={{
                background: "var(--color-canvas-cool)",
                border: "1px solid var(--color-hairline-strong)",
              }}
            >
              <Download className="h-3.5 w-3.5" /> PDF
            </a>
            <a
              href={`/api/estimates/${estimate.id}/excel`}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd"
              style={{
                background: "var(--color-canvas-cool)",
                border: "1px solid var(--color-hairline-strong)",
              }}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </a>
            <Link
              href={`/estimates/${estimate.id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd"
              style={{
                background: "var(--color-canvas-cool)",
                border: "1px solid var(--color-hairline-strong)",
              }}
            >
              <Edit className="h-3.5 w-3.5" /> Edit
            </Link>
            <EstimateDeleteButton
              estimateId={estimate.id}
              estimateTitle={estimate.title}
              redirectTo={`/projects/${estimate.project.id}?tab=estimates`}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Phases */}
          <div>
            <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
              {"// PHASES & LINE ITEMS"}
            </p>
            <div className="space-y-4">
              {estimate.phases.map((phase, idx) => {
                const phaseTotal = phase.lineItems.reduce(
                  (sum, li) => sum + li.quantity * li.unitPrice,
                  0
                );
                return (
                  <div
                    key={phase.id}
                    className="bg-card-rd rounded-[14px] overflow-hidden"
                    style={{
                      border: "1px solid var(--color-hairline)",
                      boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
                    }}
                  >
                    {/* Head */}
                    <div
                      className="px-5 py-3.5 flex items-center gap-3"
                      style={{
                        borderBottom: "1px solid var(--color-hairline)",
                        background:
                          "linear-gradient(180deg, #FCFAF6 0%, #FFFFFF 100%)",
                      }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: "var(--color-ink-300)" }}
                      />
                      <h3 className="font-mono text-[11px] font-bold tracking-[0.06em] uppercase m-0 text-ink-900">
                        Phase {idx + 1} · {phase.name}
                      </h3>
                      {phase.description && (
                        <span className="text-[12px] text-ink-500 italic">
                          — {phase.description}
                        </span>
                      )}
                      <span className="ml-auto font-mono text-[11px] tracking-[0.02em] text-ink-500">
                        {phase.lineItems.length}{" "}
                        {phase.lineItems.length === 1 ? "line" : "lines"} ·{" "}
                        <strong className="text-ink-900 font-bold rd-tabular">
                          {fmtMoney(phaseTotal)}
                        </strong>
                      </span>
                    </div>

                    {/* Column header band */}
                    <div
                      className="grid gap-3 px-5 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.06em]"
                      style={{
                        gridTemplateColumns: "1fr 90px 70px 110px 110px",
                        background: "#FAFAF6",
                        borderBottom: "1px solid var(--color-hairline)",
                        color: "var(--color-ink-400)",
                      }}
                    >
                      <span>Description</span>
                      <span>Unit</span>
                      <span className="text-right">Qty</span>
                      <span className="text-right">Unit price</span>
                      <span className="text-right">Total</span>
                    </div>

                    {/* Lines */}
                    {phase.lineItems.map((item, i) => (
                      <div
                        key={item.id}
                        className="grid gap-3 items-center px-5 py-3 hover:bg-[#FCFAF6] transition-colors"
                        style={{
                          gridTemplateColumns: "1fr 90px 70px 110px 110px",
                          borderBottom:
                            i < phase.lineItems.length - 1
                              ? "1px solid var(--color-hairline)"
                              : "none",
                        }}
                      >
                        <div>
                          <div className="text-[13px] font-medium text-ink-900 leading-[1.3] tracking-[-0.005em]">
                            {item.description}
                          </div>
                          {item.notes && (
                            <div className="font-mono text-[10px] text-ink-300 mt-0.5 tracking-[0.02em]">
                              {"// "}
                              {item.notes}
                            </div>
                          )}
                        </div>
                        <div className="text-[12px] text-ink-700">{item.unit}</div>
                        <div className="text-right text-[13px] text-ink-700 rd-tabular">
                          {item.quantity}
                        </div>
                        <div className="text-right text-[13px] text-ink-700 rd-tabular">
                          {fmtMoney(item.unitPrice)}
                        </div>
                        <div className="text-right text-[13px] font-medium text-ink-900 rd-tabular">
                          {fmtMoney(item.quantity * item.unitPrice)}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals */}
          <div>
            <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
              {"// TOTALS"}
            </p>
            <div
              className="bg-card-rd rounded-[14px] p-5"
              style={{
                border: "1px solid var(--color-hairline)",
                boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
              }}
            >
              <div className="max-w-xs ml-auto space-y-1.5">
                <div className="flex justify-between text-[12px]">
                  <span className="text-ink-500">Subtotal</span>
                  <span className="font-mono rd-tabular text-ink-700">
                    {symbol}
                    {fmt(subtotal)}
                  </span>
                </div>
                {estimate.taxRate > 0 && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-ink-500">Tax ({estimate.taxRate}%)</span>
                    <span className="font-mono rd-tabular text-ink-700">
                      {symbol}
                      {fmt(taxAmount)}
                    </span>
                  </div>
                )}
                {estimate.discount > 0 && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-ink-500">Discount</span>
                    <span className="font-mono rd-tabular text-warn-fg">
                      −{symbol}
                      {fmt(estimate.discount)}
                    </span>
                  </div>
                )}
                <div
                  className="flex justify-between pt-2 mt-2"
                  style={{ borderTop: "1px solid var(--color-hairline)" }}
                >
                  <span className="text-[13px] font-bold text-ink-900">Total</span>
                  <span className="font-mono rd-tabular text-[16px] font-bold text-accent-rd">
                    {symbol}
                    {fmt(total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details */}
          <div>
            <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
              {"// DETAILS"}
            </p>
            <div
              className="bg-card-rd rounded-[14px] p-5 space-y-3"
              style={{
                border: "1px solid var(--color-hairline)",
                boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
              }}
            >
              <div>
                <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                  {"// CLIENT"}
                </div>
                <Link
                  href={`/clients/${estimate.project.client.id}`}
                  className="text-[13px] font-medium text-ink-900 hover:text-accent-rd"
                >
                  {estimate.project.client.company}
                </Link>
              </div>

              <div>
                <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                  {"// PROJECT"}
                </div>
                <Link
                  href={`/projects/${estimate.project.id}`}
                  className="text-[13px] font-medium text-ink-900 hover:text-accent-rd"
                >
                  {estimate.project.title}
                </Link>
              </div>

              {estimate.validUntil && (
                <div>
                  <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                    {"// VALID UNTIL"}
                  </div>
                  <div className="text-[13px] text-ink-900">
                    {new Date(estimate.validUntil).toLocaleDateString()}
                  </div>
                </div>
              )}

              {estimate.exchangeRate && (
                <div>
                  <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                    {"// EXCHANGE RATE"}
                  </div>
                  <div className="text-[13px] text-ink-900 font-mono rd-tabular">
                    1 USD = {estimate.exchangeRate} CNY
                  </div>
                </div>
              )}

              {estimate.parentEstimate && (
                <div>
                  <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                    {"// ORIGINAL"}
                  </div>
                  <Link
                    href={`/estimates/${estimate.parentEstimate.id}`}
                    className="text-[13px] font-medium text-ink-900 hover:text-accent-rd font-mono"
                  >
                    {estimate.parentEstimate.estimateNumber}
                  </Link>
                </div>
              )}

              {estimate.rmbDuplicate && (
                <div>
                  <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                    {"// RMB VERSION"}
                  </div>
                  <Link
                    href={`/estimates/${estimate.rmbDuplicate.id}`}
                    className="text-[13px] font-medium text-ink-900 hover:text-accent-rd font-mono"
                  >
                    {estimate.rmbDuplicate.estimateNumber}
                  </Link>
                </div>
              )}

              <div
                className="pt-3 mt-1 space-y-3"
                style={{ borderTop: "1px solid var(--color-hairline)" }}
              >
                <div>
                  <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                    {"// CREATED BY"}
                  </div>
                  <div className="text-[12px] text-ink-700">
                    {estimate.createdBy.name}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                    {"// LAST MODIFIED"}
                  </div>
                  <div className="text-[12px] text-ink-700">
                    {new Date(estimate.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                    {"// CREATED"}
                  </div>
                  <div className="text-[12px] text-ink-700">
                    {new Date(estimate.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {(estimate.notes || estimate.clientNotes) && (
            <div>
              <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
                {"// NOTES"}
              </p>
              <div
                className="bg-card-rd rounded-[14px] p-5 space-y-3"
                style={{
                  border: "1px solid var(--color-hairline)",
                  boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
                }}
              >
                {estimate.notes && (
                  <div>
                    <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-1">
                      {"// INTERNAL"}
                    </div>
                    <div className="text-[12px] text-ink-700 whitespace-pre-wrap leading-[1.5]">
                      {estimate.notes}
                    </div>
                  </div>
                )}
                {estimate.notes && estimate.clientNotes && (
                  <div
                    style={{ borderTop: "1px dashed var(--color-hairline)" }}
                    className="pt-3"
                  />
                )}
                {estimate.clientNotes && (
                  <div>
                    <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-1">
                      {"// CLIENT-FACING"}
                    </div>
                    <div className="text-[12px] text-ink-700 whitespace-pre-wrap leading-[1.5]">
                      {estimate.clientNotes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
