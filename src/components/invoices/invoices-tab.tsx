// src/components/invoices/invoices-tab.tsx
"use client";

import Link from "next/link";
import { StatusPill } from "@/components/redesign/status-pill";
import { InvoiceStatusChanger } from "@/components/invoices/invoice-status-changer";
import { CreateRmbInvoiceButton } from "@/components/invoices/create-rmb-invoice-button";
import type { BillingState } from "@/lib/billing";
import { currencySymbol } from "@/lib/currency";

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  currency: string;
  dueDate: string | null;
  paidDate: string | null;
  exchangeRate: number | null;
  parentInvoiceId: string | null;
  rmbDuplicate: { id: string; invoiceNumber: string } | null;
  estimate: { estimateNumber: string; label: string | null; version: number } | null;
  lineCount: number;
}

export interface PendingEstimateRow {
  id: string;
  estimateNumber: string;
  version: number;
  label: string | null;
  currency: string;
  total: number;
}

interface Props {
  projectId: string;
  billing: BillingState;
  invoices: InvoiceRow[];
  hasApprovedEstimate: boolean;
  pendingEstimates?: PendingEstimateRow[];
}

function fmtMoney(currency: string, amount: number, decimals = 0): string {
  const sym = currencySymbol(currency);
  return `${sym}${amount.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function fmtDateMono(iso: string): string {
  const d = new Date(iso);
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/* ───────────────────────── billing summary card ───────────────────────── */

function BillingSummary({ billing }: { billing: BillingState }) {
  const { estimated, delivered, invoiced, paid, primaryCurrency, otherCurrencyTotals } = billing;
  const invoicedPct = estimated > 0 ? Math.min(100, Math.round((invoiced / estimated) * 100)) : 0;
  const paidPct = estimated > 0 ? Math.min(100, Math.round((paid / estimated) * 100)) : 0;

  return (
    <div
      className="rounded-[14px] p-5"
      style={{
        background: "var(--color-card-rd)",
        border: "2px solid var(--color-ink-900)",
        boxShadow: "0 6px 24px -6px rgba(15, 23, 41, 0.10), 0 2px 6px -2px rgba(15, 23, 41, 0.06)",
      }}
    >
      <div className="grid grid-cols-4 gap-6">
        <div className="pr-6" style={{ borderRight: "1px dashed var(--color-hairline)" }}>
          <p className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase m-0 mb-2 text-ink-500">
            {"// ESTIMATED"}
          </p>
          <div className="text-[22px] font-extrabold tracking-[-0.025em] leading-none rd-tabular text-ink-900 mb-1">
            {fmtMoney(primaryCurrency, estimated)}
          </div>
        </div>
        <div className="pr-6" style={{ borderRight: "1px dashed var(--color-hairline)" }}>
          <p className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase m-0 mb-2 text-ink-500">
            {"// DELIVERED"}
          </p>
          <div className="text-[22px] font-extrabold tracking-[-0.025em] leading-none rd-tabular text-ink-900 mb-1">
            {fmtMoney(primaryCurrency, delivered)}
          </div>
        </div>
        <div className="pr-6" style={{ borderRight: "1px dashed var(--color-hairline)" }}>
          <p className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase m-0 mb-2 text-ink-500">
            {"// INVOICED"}
            {invoicedPct > 0 ? ` · ${invoicedPct}%` : ""}
          </p>
          <div className="text-[22px] font-extrabold tracking-[-0.025em] leading-none rd-tabular text-ink-900 mb-1">
            {fmtMoney(primaryCurrency, invoiced)}
          </div>
          <div
            className="h-[3px] rounded-full mt-2"
            style={{ background: "var(--color-hairline)" }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${invoicedPct}%`, background: "var(--color-s-delivered)" }}
            />
          </div>
        </div>
        <div>
          <p className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase m-0 mb-2 text-ink-500">
            {"// PAID"}
            {paidPct > 0 ? ` · ${paidPct}%` : ""}
          </p>
          <div
            className="text-[22px] font-extrabold tracking-[-0.025em] leading-none rd-tabular mb-1"
            style={{ color: paid > 0 ? "var(--color-s-delivered-fg)" : "var(--color-ink-900)" }}
          >
            {fmtMoney(primaryCurrency, paid)}
          </div>
          <div
            className="h-[3px] rounded-full mt-2"
            style={{ background: "var(--color-hairline)" }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${paidPct}%`, background: "var(--color-s-delivered)" }}
            />
          </div>
        </div>
      </div>
      {otherCurrencyTotals.length > 0 && (
        <p className="font-mono text-[10px] tracking-[0.02em] m-0 mt-3 pt-3 text-ink-400" style={{ borderTop: "1px dashed var(--color-hairline)" }}>
          {otherCurrencyTotals.map((t) => `+ ${fmtMoney(t.currency, t.invoiced)} invoiced in ${t.currency}`).join(" · ")}
        </p>
      )}
    </div>
  );
}

/* ───────────────────────── main component ───────────────────────── */

export function InvoicesTab({
  projectId,
  billing,
  invoices,
  hasApprovedEstimate,
  pendingEstimates = [],
}: Props) {
  const uninvoicedRemaining = billing.delivered - billing.invoiced;
  const confirmActualsHref = `/projects/${projectId}?tab=completion`;

  return (
    <div className="space-y-6">
      <BillingSummary billing={billing} />

      {/* Pending estimates — one row per approved-but-not-yet-invoiced estimate.
          Invoice is generated downstream from Delivery & Sign-off (confirmed actuals);
          this row routes the user there with the right estimate preselected. */}
      {pendingEstimates.length > 0 && (
        <div className="space-y-2">
          <p className="font-mono text-[11px] font-bold tracking-[0.06em] uppercase m-0 text-ink-500">
            {`// AWAITING INVOICE · ${pendingEstimates.length}`}
          </p>
          {pendingEstimates.map((est) => (
            <div
              key={est.id}
              className="rounded-[12px] px-4 py-2.5 flex items-center gap-3 flex-wrap"
              style={{
                background: "var(--color-card-rd)",
                border: "1px solid var(--color-s-delivered)",
                boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
              }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: "var(--color-s-delivered)" }}
              />
              <span
                className="font-mono text-[11px] font-bold tracking-[0.06em] uppercase flex-shrink-0"
                style={{ color: "var(--color-s-delivered-fg)" }}
              >
                {est.estimateNumber}·v{est.version}
              </span>
              <StatusPill status="APPROVED" label="Approved" size="xs" />
              {est.label && (
                <span
                  className="font-mono text-[10px] tracking-[0.04em] px-1.5 py-0.5 rounded-full"
                  style={{
                    background: "var(--color-canvas-cool)",
                    color: "var(--color-ink-500)",
                    border: "1px solid var(--color-hairline)",
                  }}
                >
                  {est.label}
                </span>
              )}
              {est.currency !== "USD" && (
                <span
                  className="font-mono text-[10px] font-bold tracking-[0.04em] uppercase px-1.5 py-0.5 rounded-full"
                  style={{
                    background: "var(--color-canvas-cool)",
                    color: "var(--color-ink-700)",
                    border: "1px solid var(--color-hairline)",
                  }}
                >
                  {est.currency}
                </span>
              )}
              <span className="font-mono text-[10px] tracking-[0.02em] flex-shrink-0" style={{ color: "var(--color-ink-400)" }}>
                {"// AWAITING ACTUALS"}
              </span>
              <span
                className="ml-auto font-mono text-[12px] font-bold rd-tabular flex-shrink-0"
                style={{ color: "var(--color-ink-900)" }}
              >
                {fmtMoney(est.currency, est.total)}
              </span>
              <Link
                href={`/projects/${projectId}?tab=completion&estimate=${est.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white tracking-[-0.005em]"
                style={{
                  background: "var(--color-s-delivered)",
                  boxShadow: "0 4px 12px -2px rgba(5, 150, 105, 0.28)",
                }}
              >
                Confirm actuals →
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Existing invoices */}
      {invoices.length === 0 ? (
        pendingEstimates.length === 0 && (
          <div
            className="rounded-[14px] p-8 text-center"
            style={{
              background: "var(--color-card-rd)",
              border: "1px solid var(--color-hairline)",
              boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
            }}
          >
            <p className="font-mono text-[11px] font-bold tracking-[0.06em] uppercase m-0 mb-2 text-ink-400">
              {"// NO INVOICES"}
            </p>
            <p className="text-[13px] m-0 mb-3" style={{ color: "var(--color-ink-500)" }}>
              {hasApprovedEstimate
                ? "An estimate is approved — confirm actuals to generate the first invoice."
                : "Approve an estimate to enable invoicing."}
            </p>
            {hasApprovedEstimate && (
              <Link
                href={confirmActualsHref}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[13px] font-medium text-white"
                style={{
                  background: "var(--color-ink-900)",
                }}
              >
                Go to Confirm actuals
              </Link>
            )}
          </div>
        )
      ) : (
        <div className="space-y-3">
          <p className="font-mono text-[11px] font-bold tracking-[0.06em] uppercase m-0 text-ink-500">
            {`// INVOICES · ${invoices.length}`}
          </p>
          {invoices.map((invoice) => {
            const isRmb = !!invoice.parentInvoiceId;
            const accent = isRmb ? "rgba(217, 119, 6, 0.55)" : "var(--color-hairline)";
            return (
              <div
                key={invoice.id}
                className="rounded-[12px] px-4 py-2.5 flex items-center gap-3 flex-wrap"
                style={{
                  background: "var(--color-card-rd)",
                  border: `1px solid ${accent}`,
                  boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
                }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    background:
                      invoice.status === "PAID"
                        ? "var(--color-s-delivered)"
                        : invoice.status === "OVERDUE"
                        ? "#DC2626"
                        : "var(--color-ink-300)",
                  }}
                />
                <span className="font-mono text-[11px] font-bold tracking-[0.06em] uppercase text-ink-500 flex-shrink-0">
                  {invoice.invoiceNumber}
                </span>
                <StatusPill status={invoice.status} size="xs" />
                {isRmb && (
                  <span
                    className="font-mono text-[10px] font-bold tracking-[0.04em] uppercase px-1.5 py-0.5 rounded-full"
                    style={{ background: "rgba(217, 119, 6, 0.10)", color: "#A85614" }}
                  >
                    RMB
                  </span>
                )}
                {invoice.currency !== "USD" && !isRmb && (
                  <span
                    className="font-mono text-[10px] font-bold tracking-[0.04em] uppercase px-1.5 py-0.5 rounded-full"
                    style={{
                      background: "var(--color-canvas-cool)",
                      color: "var(--color-ink-700)",
                      border: "1px solid var(--color-hairline)",
                    }}
                  >
                    {invoice.currency}
                  </span>
                )}
                {invoice.estimate && (
                  <span className="font-mono text-[10px] tracking-[0.02em] text-ink-400 flex-shrink-0 hidden md:inline">
                    {`// FROM ${invoice.estimate.estimateNumber} v${invoice.estimate.version} · ${invoice.lineCount}L`}
                  </span>
                )}
                {invoice.dueDate && !invoice.paidDate && (
                  <span className="font-mono text-[10px] tracking-[0.02em] text-ink-400 flex-shrink-0">
                    {`DUE ${fmtDateMono(invoice.dueDate)}`}
                  </span>
                )}
                {invoice.paidDate && (
                  <span className="font-mono text-[10px] tracking-[0.02em] flex-shrink-0" style={{ color: "var(--color-s-delivered-fg)" }}>
                    {`PAID ${fmtDateMono(invoice.paidDate)}`}
                  </span>
                )}
                <span
                  className="ml-auto font-mono text-[12px] font-bold rd-tabular flex-shrink-0"
                  style={{ color: "var(--color-ink-900)" }}
                >
                  {fmtMoney(invoice.currency, invoice.total)}
                </span>
                <InvoiceStatusChanger invoiceId={invoice.id} currentStatus={invoice.status} />
                {!isRmb && (
                  <CreateRmbInvoiceButton
                    invoiceId={invoice.id}
                    invoiceNumber={invoice.invoiceNumber}
                    hasRmbDuplicate={!!invoice.rmbDuplicate}
                  />
                )}
                <Link
                  href={`/invoices/${invoice.id}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd"
                  style={{
                    background: "var(--color-canvas-cool)",
                    border: "1px solid var(--color-hairline-strong)",
                  }}
                >
                  View
                </Link>
                <a
                  href={`/api/invoices/${invoice.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd"
                  style={{
                    background: "var(--color-canvas-cool)",
                    border: "1px solid var(--color-hairline-strong)",
                  }}
                >
                  PDF
                </a>
              </div>
            );
          })}
        </div>
      )}

      {uninvoicedRemaining > 0 && billing.invoiced > 0 && hasApprovedEstimate && (
        <div
          className="rounded-[14px] p-4 flex items-center justify-between gap-3 flex-wrap"
          style={{
            background: "rgba(252, 211, 77, 0.10)",
            border: "1px solid rgba(217, 119, 6, 0.30)",
          }}
        >
          <p className="text-[13px] m-0" style={{ color: "#854D0E" }}>
            <strong className="rd-tabular">
              {fmtMoney(billing.primaryCurrency, uninvoicedRemaining)}
            </strong>{" "}
            still uninvoiced — confirm more actuals to bill the remainder.
          </p>
          <Link
            href={confirmActualsHref}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd"
            style={{
              background: "var(--color-card-rd)",
              border: "1px solid var(--color-hairline-strong)",
            }}
          >
            Confirm actuals
          </Link>
        </div>
      )}
    </div>
  );
}
