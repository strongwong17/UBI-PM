// src/components/invoices/send-invoice-page.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { StatusPill } from "@/components/redesign/status-pill";
import { ProjectStatusStepper } from "@/components/projects/project-status-stepper";
import { showUnderDevToast } from "@/components/redesign/under-dev-toast";
import { phaseTokens } from "@/lib/redesign-tokens";
import { currencySymbol } from "@/lib/currency";

/* ───────────────────────────── Types ───────────────────────────── */

export interface SendInvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sortOrder: number;
  serviceModuleType: string | null;
}

export interface SendInvoiceData {
  id: string;
  invoiceNumber: string;
  status: string;
  currency: string;
  subtotal: number;
  taxRate: number;
  tax: number;
  discount: number;
  total: number;
  notes: string | null;
  issuedDate: string | null;
  dueDate: string | null;
  createdAt: string;
  project: {
    id: string;
    projectNumber: string;
    title: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    client: {
      id: string;
      company: string;
      billingName: string | null;
      billingAddress: string | null;
      billingEmail: string | null;
      billingPhone: string | null;
      taxId: string | null;
      email: string | null;
    };
    primaryContact: {
      id: string;
      name: string;
      email: string | null;
    } | null;
    assignedTo: {
      id: string;
      name: string | null;
      email: string | null;
    } | null;
  };
  estimate: {
    id: string;
    estimateNumber: string;
    label: string | null;
    version: number;
  } | null;
  lineItems: SendInvoiceLine[];
}

interface BusinessProfile {
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
}

interface Props {
  invoice: SendInvoiceData;
  business: BusinessProfile | null;
  sender: { name: string | null; email: string | null };
}

/* ───────────────────────────── Helpers ───────────────────────────── */

// Map serviceModuleType → execution phase key (matches phaseTokens groups).
function moduleToPhase(
  moduleType: string | null,
): "RECRUITMENT" | "FIELDWORK" | "ANALYSIS" | "REPORTING" | "OTHER" {
  switch (moduleType) {
    case "RECRUITMENT":
      return "RECRUITMENT";
    case "MODERATION":
    case "SIMULTANEOUS_TRANSLATION":
    case "VENUE":
    case "INCENTIVES":
    case "LOGISTICS":
      return "FIELDWORK";
    case "REPORTING":
      return "REPORTING";
    case "PROJECT_MANAGEMENT":
      return "ANALYSIS";
    default:
      return "OTHER";
  }
}

const PHASE_LABEL: Record<string, string> = {
  RECRUITMENT: "Recruitment",
  FIELDWORK: "Fieldwork",
  ANALYSIS: "Analysis",
  REPORTING: "Reporting",
  OTHER: "Other",
};

function fmtMoney(currency: string, amount: number): string {
  const sym = currencySymbol(currency);
  return `${sym}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtMoneyRound(currency: string, amount: number): string {
  const sym = currencySymbol(currency);
  return `${sym}${Math.round(amount).toLocaleString("en-US")}`;
}

function fmtDateLong(d: string | null | Date): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtTimeShort(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ───────────────────────────── Component ───────────────────────────── */

export function SendInvoicePage({ invoice, business, sender }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const sym = currencySymbol(invoice.currency);

  // Default issue/due dates: use what's stored on the invoice; otherwise today + 30 days.
  const issueDate = invoice.issuedDate ? new Date(invoice.issuedDate) : new Date();
  const dueDate = invoice.dueDate
    ? new Date(invoice.dueDate)
    : new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Pre-fill subject + message
  const firstName =
    invoice.project.primaryContact?.name?.split(/\s+/)[0] ?? "there";
  const senderFirst =
    sender.name?.split(/\s+/)[0] ?? "the UBInsights team";

  const defaultSubject = `UBInsights · Invoice ${invoice.invoiceNumber} · ${invoice.project.title}`;
  const defaultMessage = useMemo(() => {
    const totalText = `${sym}${invoice.total.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
    return `Hi ${firstName},

Thanks again for partnering with us on the ${invoice.project.title.toLowerCase()} study. Attached is the final invoice for ${invoice.invoiceNumber}, total ${totalText}.

Let me know if you have any questions on the line items.

Best,
${senderFirst}`;
  }, [firstName, invoice.invoiceNumber, invoice.project.title, invoice.total, senderFirst, sym]);

  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(defaultMessage);

  const recipient = invoice.project.primaryContact ?? null;

  /* ────── Actions ────── */

  async function markSent(opts: { openPdf?: boolean } = {}) {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (opts.openPdf) {
        window.open(`/api/invoices/${invoice.id}/pdf`, "_blank");
      }
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SENT" }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Invoice marked as sent");
      router.push(`/?hub=completion`);
    } catch {
      toast.error("Failed to mark invoice as sent");
    } finally {
      setSubmitting(false);
    }
  }

  /* ────── Group lines by phase for nice colored tags ────── */

  const lines = invoice.lineItems;

  /* ────── Render ────── */

  return (
    <div className="space-y-6 max-w-[1320px] mx-auto">
      {/* Crumbs */}
      <div className="font-mono text-[11px] text-ink-400 mb-3 tracking-[0.02em]">
        <Link href="/projects" className="text-ink-400 hover:text-ink-700 no-underline">
          Projects
        </Link>
        <span className="mx-1.5 text-ink-300">›</span>
        <Link
          href={`/clients/${invoice.project.client.id}`}
          className="text-ink-400 hover:text-ink-700 no-underline"
        >
          {invoice.project.client.company}
        </Link>
        <span className="mx-1.5 text-ink-300">›</span>
        <Link
          href={`/projects/${invoice.project.id}`}
          className="text-ink-400 hover:text-ink-700 no-underline"
        >
          {invoice.project.projectNumber}
        </Link>
        <span className="mx-1.5 text-ink-300">›</span>
        <span className="text-ink-700 font-semibold">Send invoice</span>
      </div>

      {/* Project header */}
      <div className="flex items-start justify-between gap-6 flex-wrap mb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="font-mono text-[11px] font-semibold text-ink-300 tracking-[0.04em]">
              {invoice.project.projectNumber}
            </span>
            <StatusPill status={invoice.project.status} />
          </div>
          <h1 className="text-2xl font-bold tracking-[-0.025em] mb-1.5">
            {invoice.project.title}
          </h1>
          <p className="text-[13px] text-ink-500">
            {invoice.project.client.company} · ready to invoice · total {fmtMoneyRound(invoice.currency, invoice.total)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${invoice.project.id}?tab=completion`}
            className="bg-card-rd text-ink-900 px-3.5 py-2 rounded-[9px] border border-hairline text-[13px] font-medium hover:border-hairline-strong hover:shadow-sm no-underline"
          >
            ← Back to actuals
          </Link>
        </div>
      </div>

      {/* Stage stepper */}
      <ProjectStatusStepper
        projectId={invoice.project.id}
        currentStatus={invoice.project.status}
        context={{
          hasInquiry: false,
          estimateCount: 0,
          approvedEstimateCount: 0,
          invoiceCount: 1,
          hasUninvoicedApproved: false,
          updatedAt: invoice.createdAt,
          startDate: invoice.project.startDate,
          contactEmail: invoice.project.primaryContact?.email ?? null,
          contactName: invoice.project.primaryContact?.name ?? null,
        }}
      />

      {/* Project tabs (visual only — Invoice active) */}
      <div className="flex gap-0.5 border-b border-hairline mb-6">
        {[
          { value: "overview", label: "Overview", href: `/projects/${invoice.project.id}?tab=overview` },
          { value: "estimates", label: "Estimates", href: `/projects/${invoice.project.id}?tab=estimates` },
          { value: "execution", label: "Execution", href: `/projects/${invoice.project.id}?tab=execution` },
          {
            value: "completion",
            label: "Confirm Actuals",
            sub: "✓ done",
            href: `/projects/${invoice.project.id}?tab=completion`,
          },
          { value: "invoice", label: "Invoice", active: true, href: `/projects/${invoice.project.id}?tab=invoice` },
        ].map((t) => (
          <Link
            key={t.value}
            href={t.href}
            className={
              "px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px no-underline transition-colors " +
              (t.active
                ? "text-ink-900 border-ink-900 font-semibold"
                : "text-ink-500 border-transparent hover:text-ink-900")
            }
          >
            {t.label}
            {t.sub && (
              <span className="font-mono text-[11px] text-ink-300 ml-1">{t.sub}</span>
            )}
          </Link>
        ))}
      </div>

      {/* Just-generated banner */}
      <div
        className="rounded-[10px] px-4 py-3 mb-5 flex items-center gap-3"
        style={{
          background:
            "linear-gradient(180deg, rgba(5, 150, 105, 0.08) 0%, rgba(5, 150, 105, 0.04) 100%)",
          border: "1px solid var(--color-s-delivered)",
        }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[13px] flex-shrink-0"
          style={{ background: "var(--color-s-delivered)" }}
        >
          ⚡
        </div>
        <div>
          <div className="text-[13px] text-ink-700 leading-[1.4]">
            <strong className="text-ink-900 font-semibold">
              Draft invoice generated from confirmed actuals
            </strong>{" "}
            · {invoice.lineItems.length} line items pulled from delivered quantities
          </div>
          <div className="font-mono text-[11px] text-ink-500 tracking-[0.02em] mt-0.5">
            {"// "}{invoice.invoiceNumber} · {invoice.status} · created {fmtTimeShort(invoice.createdAt)}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* LEFT: Invoice document */}
        <div
          className="bg-white rounded-2xl overflow-hidden border border-hairline"
          style={{ boxShadow: "var(--shadow-md, 0 6px 24px -6px rgba(15,23,41,0.10))" }}
        >
          {/* Toolbar */}
          <div
            className="flex items-center justify-between px-5 py-3 border-b border-hairline font-mono text-[11px] text-ink-500 tracking-[0.02em]"
            style={{ background: "#FAFAF6" }}
          >
            <div className="flex items-center gap-2.5">
              <span>
                <strong className="text-ink-900 font-bold">{invoice.invoiceNumber}</strong> ·{" "}
                {invoice.status} preview
              </span>
            </div>
            <div className="flex bg-card-rd border border-hairline rounded-[7px] p-0.5">
              <button
                type="button"
                className="px-2.5 py-1 rounded-[5px] font-mono text-[10px] font-bold uppercase tracking-[0.04em] text-white"
                style={{ background: "var(--color-ink-900)" }}
              >
                Client view
              </button>
              <button
                type="button"
                onClick={() => router.push(`/invoices/${invoice.id}`)}
                className="px-2.5 py-1 rounded-[5px] font-mono text-[10px] font-bold uppercase tracking-[0.04em] text-ink-500 hover:text-ink-900"
              >
                Edit
              </button>
            </div>
          </div>

          {/* Invoice document body */}
          <div className="px-14 py-12 text-ink-900">
            {/* Doc head */}
            <div
              className="flex justify-between items-start pb-7 mb-7"
              style={{ borderBottom: "2px solid var(--color-ink-900)" }}
            >
              <div>
                <div className="text-[18px] font-extrabold tracking-[-0.04em] inline-flex items-baseline gap-0.5">
                  ubinsights
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full -translate-y-px ml-px"
                    style={{ background: "var(--color-accent-rd)" }}
                  />
                </div>
                <div className="text-[11px] text-ink-500 leading-[1.5] mt-2">
                  {business?.name ?? "UBInsights Research Co., Ltd."}
                  <br />
                  {business?.address ?? "Suite 18-3F, 1228 Yan'an Middle Road"}
                  {!business?.address && (
                    <>
                      <br />
                      Shanghai, China 200040
                    </>
                  )}
                  <br />
                  {business?.email ?? "billing@ubinsights.com"}
                  {business?.phone && (
                    <>
                      <br />
                      {business.phone}
                    </>
                  )}
                </div>
              </div>
              <div>
                <h2 className="text-[28px] font-extrabold tracking-[-0.025em] uppercase m-0 text-right">
                  Invoice
                </h2>
                <div className="font-mono text-[12px] text-ink-500 tracking-[0.04em] text-right">
                  {invoice.invoiceNumber}
                </div>
              </div>
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-6 mb-8">
              <div className="text-[11px] text-ink-500">
                <p className="font-mono text-[9px] font-bold tracking-[0.06em] uppercase text-ink-300 m-0 mb-1.5">
                  {"// Bill to"}
                </p>
                <div className="text-ink-900 text-[13px] font-medium leading-[1.4]">
                  {invoice.project.client.billingName ?? invoice.project.client.company}
                </div>
                <div className="text-ink-500 text-[11px] mt-0.5 whitespace-pre-line">
                  {invoice.project.primaryContact?.name && (
                    <>
                      Attn: {invoice.project.primaryContact.name}
                      {"\n"}
                    </>
                  )}
                  {invoice.project.client.billingAddress ?? ""}
                </div>
              </div>
              <div className="text-[11px] text-ink-500">
                <p className="font-mono text-[9px] font-bold tracking-[0.06em] uppercase text-ink-300 m-0 mb-1.5">
                  {"// Issue date"}
                </p>
                <div className="text-ink-900 text-[13px] font-medium">
                  {fmtDateLong(issueDate)}
                </div>
              </div>
              <div className="text-[11px] text-ink-500">
                <p className="font-mono text-[9px] font-bold tracking-[0.06em] uppercase text-ink-300 m-0 mb-1.5">
                  {"// Due date"}
                </p>
                <div className="text-ink-900 text-[13px] font-medium">
                  {fmtDateLong(dueDate)}
                </div>
                <div className="text-ink-500 text-[11px] mt-0.5">NET 30</div>
              </div>
              <div className="text-[11px] text-ink-500">
                <p className="font-mono text-[9px] font-bold tracking-[0.06em] uppercase text-ink-300 m-0 mb-1.5">
                  {"// Project"}
                </p>
                <div className="text-ink-900 text-[13px] font-medium">
                  {invoice.project.title}
                </div>
                <div className="text-ink-500 text-[11px] mt-0.5">
                  {invoice.project.projectNumber}
                </div>
              </div>
            </div>

            {/* Line items table */}
            <table className="w-full border-collapse mb-6">
              <thead>
                <tr>
                  <th
                    className="font-mono text-[9px] font-bold tracking-[0.06em] uppercase text-ink-400 text-left py-2.5 px-3"
                    style={{ width: "46%", borderBottom: "1px solid var(--color-ink-900)" }}
                  >
                    Description
                  </th>
                  <th
                    className="font-mono text-[9px] font-bold tracking-[0.06em] uppercase text-ink-400 text-right py-2.5 px-3"
                    style={{ borderBottom: "1px solid var(--color-ink-900)" }}
                  >
                    Qty
                  </th>
                  <th
                    className="font-mono text-[9px] font-bold tracking-[0.06em] uppercase text-ink-400 text-right py-2.5 px-3"
                    style={{ borderBottom: "1px solid var(--color-ink-900)" }}
                  >
                    Rate
                  </th>
                  <th
                    className="font-mono text-[9px] font-bold tracking-[0.06em] uppercase text-ink-400 text-right py-2.5 px-3"
                    style={{ borderBottom: "1px solid var(--color-ink-900)" }}
                  >
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="text-center text-[12px] text-ink-400 py-6"
                      style={{ borderBottom: "1px dashed var(--color-hairline)" }}
                    >
                      No line items.
                    </td>
                  </tr>
                ) : (
                  lines.map((li) => {
                    const phase = moduleToPhase(li.serviceModuleType);
                    const t = phaseTokens(phase);
                    const isOther = phase === "OTHER";
                    return (
                      <tr key={li.id}>
                        <td
                          className="py-2.5 px-3 text-[12px] text-ink-700 align-top"
                          style={{ borderBottom: "1px dashed var(--color-hairline)" }}
                        >
                          <div className="text-ink-900 font-medium">{li.description}</div>
                          {!isOther && (
                            <div
                              className="font-mono text-[9px] font-bold tracking-[0.04em] uppercase mt-0.5 flex items-center gap-1.5"
                              style={{ color: "var(--color-ink-400)" }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ background: t.dot }}
                              />
                              {PHASE_LABEL[phase]}
                            </div>
                          )}
                        </td>
                        <td
                          className="py-2.5 px-3 text-[12px] text-ink-700 text-right tabular-nums align-top"
                          style={{ borderBottom: "1px dashed var(--color-hairline)" }}
                        >
                          {li.quantity}
                        </td>
                        <td
                          className="py-2.5 px-3 text-[12px] text-ink-700 text-right tabular-nums align-top"
                          style={{ borderBottom: "1px dashed var(--color-hairline)" }}
                        >
                          {fmtMoney(invoice.currency, li.unitPrice)}
                        </td>
                        <td
                          className="py-2.5 px-3 text-[12px] text-ink-700 text-right tabular-nums align-top"
                          style={{ borderBottom: "1px dashed var(--color-hairline)" }}
                        >
                          {fmtMoney(invoice.currency, li.total)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td
                    colSpan={3}
                    className="py-2 px-3 text-right font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500"
                  >
                    Subtotal
                  </td>
                  <td className="py-2 px-3 text-right text-[12px] text-ink-700 tabular-nums">
                    {fmtMoney(invoice.currency, invoice.subtotal)}
                  </td>
                </tr>
                {invoice.discount > 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-2 px-3 text-right font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500"
                    >
                      Discount
                    </td>
                    <td className="py-2 px-3 text-right text-[12px] text-ink-700 tabular-nums">
                      −{fmtMoney(invoice.currency, invoice.discount)}
                    </td>
                  </tr>
                )}
                <tr>
                  <td
                    colSpan={3}
                    className="py-2 px-3 text-right font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500"
                  >
                    Tax · {invoice.taxRate}%
                  </td>
                  <td className="py-2 px-3 text-right text-[12px] text-ink-700 tabular-nums">
                    {fmtMoney(invoice.currency, invoice.tax)}
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan={3}
                    className="pt-3 px-3 text-right font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500"
                    style={{ borderTop: "2px solid var(--color-ink-900)" }}
                  >
                    Total due
                  </td>
                  <td
                    className="pt-3 px-3 text-right text-[14px] font-extrabold text-ink-900 tabular-nums tracking-[-0.01em]"
                    style={{ borderTop: "2px solid var(--color-ink-900)" }}
                  >
                    {fmtMoney(invoice.currency, invoice.total)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Notes / payment instructions */}
            <div className="mt-7 pt-5 border-t border-hairline text-[11px] text-ink-500 leading-[1.6]">
              <p className="font-mono text-[9px] font-bold tracking-[0.06em] uppercase text-ink-700 m-0 mb-1.5">
                {"// Payment instructions"}
              </p>
              <p className="m-0 mb-2">Please remit payment within 30 days to:</p>
              <p className="m-0 font-mono text-[11px] text-ink-700">
                UBInsights Research Co., Ltd.
                <br />
                HSBC Bank · Shanghai Branch
                <br />
                Account: 8842-1004-5567
                <br />
                SWIFT: HSBCCNSH
              </p>
              {invoice.notes && (
                <p className="mt-3 mb-0 whitespace-pre-line">{invoice.notes}</p>
              )}
              <p className="mt-3.5 mb-0 italic">
                Thank you for your business — looking forward to the next study together.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT: Send panel (sticky) */}
        <div className="lg:sticky lg:top-4 space-y-4">
          <div
            className="bg-card-rd border border-hairline rounded-[14px] px-5 py-5"
            style={{ boxShadow: "var(--shadow-md, 0 6px 24px -6px rgba(15,23,41,0.10))" }}
          >
            <h3 className="text-[14px] font-bold tracking-[-0.01em] text-ink-900 m-0 mb-1 flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background: "var(--color-s-delivered)",
                  boxShadow: "0 0 0 3px rgba(5, 150, 105, 0.18)",
                }}
              />
              Ready to send
            </h3>
            <p className="text-[12px] text-ink-500 m-0 mb-4">
              Pick a delivery method below. The invoice will move from{" "}
              <strong>DRAFT → SENT</strong> and the project will appear under &ldquo;Awaiting payment&rdquo; in
              Hub 3.
            </p>

            {/* Recipient */}
            <div className="mb-3.5">
              <p className="font-mono text-[9px] font-bold tracking-[0.06em] uppercase text-ink-500 m-0 mb-1.5 flex items-center justify-between">
                <span>{"// Send to"}</span>
                <button
                  type="button"
                  onClick={() => showUnderDevToast("Change recipient")}
                  className="font-mono text-[9px] font-semibold tracking-[0.06em] uppercase text-ink-700 hover:text-ink-900 bg-transparent border-0 p-0 cursor-pointer"
                >
                  Change
                </button>
              </p>
              <div
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-[7px] border border-hairline"
                style={{ background: "var(--color-canvas-cool)" }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                  style={{ background: "var(--color-accent-rd)" }}
                >
                  {initials(recipient?.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-ink-900 leading-[1.2]">
                    {recipient?.name ?? "No primary contact"}
                  </div>
                  <div className="font-mono text-[10px] text-ink-500 mt-0.5 tracking-[0.02em] truncate">
                    {recipient?.email ??
                      invoice.project.client.billingEmail ??
                      invoice.project.client.email ??
                      "no email on file"}
                  </div>
                </div>
              </div>
            </div>

            {/* Subject */}
            <div className="mb-3.5">
              <p className="font-mono text-[9px] font-bold tracking-[0.06em] uppercase text-ink-500 m-0 mb-1.5">
                {"// Subject"}
              </p>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-2.5 py-2 rounded-[7px] border border-hairline text-[12px] text-ink-900 outline-none focus:border-ink-700 focus:bg-white"
                style={{ background: "var(--color-canvas-cool)" }}
              />
            </div>

            {/* Message */}
            <div className="mb-3.5">
              <p className="font-mono text-[9px] font-bold tracking-[0.06em] uppercase text-ink-500 m-0 mb-1.5 flex items-center justify-between">
                <span>{"// Message"}</span>
                <button
                  type="button"
                  onClick={() => showUnderDevToast("Apply template")}
                  className="font-mono text-[9px] font-semibold tracking-[0.06em] uppercase text-ink-700 hover:text-ink-900 bg-transparent border-0 p-0 cursor-pointer"
                >
                  Use template
                </button>
              </p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="w-full px-2.5 py-2 rounded-[7px] border border-hairline text-[12px] text-ink-900 leading-[1.5] resize-y min-h-[88px] outline-none focus:border-ink-700 focus:bg-white"
                style={{ background: "var(--color-canvas-cool)" }}
              />
            </div>

            {/* Send method buttons */}
            <div className="flex flex-col gap-2 mb-3.5">
              {/* Primary: Send via email (under dev) */}
              <button
                type="button"
                onClick={() => showUnderDevToast("Send via email")}
                className="flex items-center gap-3 px-3.5 py-3 rounded-[10px] border text-left text-white cursor-pointer hover:-translate-y-px transition-all"
                style={{
                  background: "var(--color-s-delivered)",
                  borderColor: "var(--color-s-delivered)",
                  filter: "grayscale(0.6)",
                }}
                disabled={submitting}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.18)" }}
                >
                  ✉
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold leading-[1.2] mb-0.5 tracking-[-0.005em]">
                    Send via email{" "}
                    <span
                      className="font-mono text-[9px] px-1.5 py-px rounded-full tracking-[0.06em] font-bold uppercase ml-1.5 align-middle inline-block"
                      style={{ background: "var(--color-ink-300)", color: "white" }}
                    >
                      soon
                    </span>
                  </div>
                  <div className="text-[11px] opacity-75 leading-[1.4]">
                    Email the invoice + PDF attachment to{" "}
                    {recipient?.name?.split(/\s+/)[0] ?? "the client"}
                  </div>
                </div>
                <span className="text-[14px] opacity-60">→</span>
              </button>

              {/* Active: Download PDF & mark as sent */}
              <button
                type="button"
                onClick={() => markSent({ openPdf: true })}
                disabled={submitting}
                className="flex items-center gap-3 px-3.5 py-3 rounded-[10px] border border-hairline bg-card-rd text-ink-900 text-left cursor-pointer hover:border-hairline-strong hover:shadow-sm hover:-translate-y-px transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                  style={{ background: "var(--color-canvas-cool)" }}
                >
                  ⬇
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold leading-[1.2] mb-0.5 tracking-[-0.005em]">
                    Download PDF &amp; mark as sent
                  </div>
                  <div className="text-[11px] text-ink-500 leading-[1.4]">
                    For when you&apos;ll send via your own email or messenger
                  </div>
                </div>
                {submitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin opacity-60" />
                ) : (
                  <span className="text-[14px] opacity-60">→</span>
                )}
              </button>

              {/* Future: Copy share link */}
              <button
                type="button"
                onClick={() => showUnderDevToast("Copy share link")}
                className="flex items-center gap-3 px-3.5 py-3 rounded-[10px] border border-hairline bg-card-rd text-ink-900 text-left cursor-pointer hover:border-hairline-strong hover:shadow-sm hover:-translate-y-px transition-all"
                style={{ filter: "grayscale(0.6)" }}
                disabled={submitting}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                  style={{ background: "var(--color-canvas-cool)" }}
                >
                  🔗
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold leading-[1.2] mb-0.5 tracking-[-0.005em]">
                    Copy share link{" "}
                    <span
                      className="font-mono text-[9px] px-1.5 py-px rounded-full tracking-[0.06em] font-bold uppercase ml-1.5 align-middle inline-block"
                      style={{ background: "var(--color-ink-300)", color: "white" }}
                    >
                      soon
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-500 leading-[1.4]">
                    A view-only invoice page the client can open without login
                  </div>
                </div>
                <span className="text-[14px] opacity-60">→</span>
              </button>
            </div>

            {/* Subtle escape: mark sent without delivering */}
            <div className="text-center mt-1.5">
              <button
                type="button"
                onClick={() => markSent()}
                disabled={submitting}
                className="text-[11px] text-ink-500 hover:text-ink-900 bg-transparent border-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" /> marking…
                  </span>
                ) : (
                  <>or just mark as sent without delivering →</>
                )}
              </button>
            </div>
          </div>

          {/* "After you send" card */}
          <div
            className="rounded-xl px-4 py-3.5"
            style={{
              background: "linear-gradient(180deg, #FCFAF6 0%, #F5F0E2 100%)",
              border: "1px solid var(--color-hairline-strong)",
            }}
          >
            <p className="font-mono text-[9px] font-bold tracking-[0.06em] uppercase text-ink-500 m-0 mb-2">
              {"// After you send"}
            </p>
            {[
              {
                n: 1,
                body: (
                  <>
                    Status flips <strong className="font-semibold">DRAFT → SENT</strong>. Audit trail
                    records who sent it and when.
                  </>
                ),
              },
              {
                n: 2,
                body: (
                  <>
                    Project appears in Hub 3 under{" "}
                    <strong className="font-semibold">Awaiting payment</strong> with the due date
                    counting down.
                  </>
                ),
              },
              {
                n: 3,
                body: (
                  <>You can send a payment reminder from there (manual today, automated soon).</>
                ),
              },
              {
                n: 4,
                body: (
                  <>
                    Once you mark the invoice <strong className="font-semibold">PAID</strong>, the
                    project is ready to archive into Hub 4.
                  </>
                ),
              },
            ].map((step) => (
              <div
                key={step.n}
                className="flex gap-2 py-1.5 text-[11px] text-ink-700 leading-[1.5]"
              >
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 mt-px"
                  style={{ background: "var(--color-ink-900)" }}
                >
                  {step.n}
                </div>
                <div>{step.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
