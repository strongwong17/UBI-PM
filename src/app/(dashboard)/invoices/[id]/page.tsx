import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currencySymbol } from "@/lib/currency";
import { StatusPill } from "@/components/redesign/status-pill";
import { ArrowLeft, Download } from "lucide-react";
import { InvoiceStatusChanger } from "@/components/invoices/invoice-status-changer";
import { CreateRmbInvoiceButton } from "@/components/invoices/create-rmb-invoice-button";
import { InvoiceLineEditor } from "@/components/invoices/invoice-line-editor";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      project: { include: { client: true } },
      lineItems: { orderBy: { sortOrder: "asc" } },
      rmbDuplicate: { select: { id: true, invoiceNumber: true } },
      parentInvoice: { select: { id: true, invoiceNumber: true } },
    },
  });

  if (!invoice) notFound();

  const sym = currencySymbol(invoice.currency);
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const isDraft = invoice.status === "DRAFT";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900 mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to invoices
        </Link>

        <div
          className="flex items-start justify-between gap-4 flex-wrap pb-[18px]"
          style={{ borderBottom: "1px solid var(--color-hairline)" }}
        >
          <div>
            <div className="font-mono text-[11px] text-ink-500 tracking-[0.04em] mb-1.5">
              <Link
                href={`/clients/${invoice.project.client.id}`}
                className="hover:text-accent-rd"
              >
                {invoice.project.client.company}
              </Link>
              {" · "}
              <Link
                href={`/projects/${invoice.project.id}?tab=invoice`}
                className="hover:text-accent-rd"
              >
                {invoice.project.title}
              </Link>
            </div>
            <h1 className="text-[24px] font-bold tracking-[-0.025em] text-ink-900 m-0 mb-2 font-mono">
              {invoice.invoiceNumber}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusPill status={invoice.status} />
              {invoice.currency !== "USD" && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-[0.06em] uppercase"
                  style={{
                    background: "var(--color-canvas-cool)",
                    color: "var(--color-ink-700)",
                    border: "1px solid var(--color-hairline-strong)",
                  }}
                >
                  {invoice.currency}
                </span>
              )}
              {invoice.parentInvoiceId && (
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
              {isDraft && (
                <span className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-accent-rd">
                  Editable
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <InvoiceStatusChanger invoiceId={invoice.id} currentStatus={invoice.status} />
            {!invoice.parentInvoiceId && (
              <CreateRmbInvoiceButton
                invoiceId={invoice.id}
                invoiceNumber={invoice.invoiceNumber}
                hasRmbDuplicate={!!invoice.rmbDuplicate}
              />
            )}
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd"
              style={{
                background: "var(--color-canvas-cool)",
                border: "1px solid var(--color-hairline-strong)",
              }}
            >
              <Download className="h-3.5 w-3.5" /> PDF
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {isDraft ? (
            <div>
              <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
                {"// LINE ITEMS · DRAFT"}
              </p>
              <div
                className="bg-card-rd rounded-[14px] p-5"
                style={{
                  border: "1px solid var(--color-hairline)",
                  boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
                }}
              >
                <div className="text-[12px] text-ink-500 mb-3">
                  Adjust quantities and discount before sending.
                </div>
                <InvoiceLineEditor
                  invoiceId={invoice.id}
                  lineItems={invoice.lineItems.map((li) => ({
                    id: li.id,
                    description: li.description,
                    quantity: li.quantity,
                    unitPrice: li.unitPrice,
                    total: li.total,
                    sortOrder: li.sortOrder,
                  }))}
                  discount={invoice.discount}
                  taxRate={invoice.taxRate}
                  currencySymbol={sym}
                />
              </div>
            </div>
          ) : (
            <>
              <div>
                <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
                  {"// LINE ITEMS"}
                </p>
                <div
                  className="bg-card-rd rounded-[14px] overflow-hidden"
                  style={{
                    border: "1px solid var(--color-hairline)",
                    boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
                  }}
                >
                  {/* Column header band */}
                  <div
                    className="grid gap-3 px-5 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.06em]"
                    style={{
                      gridTemplateColumns: "1fr 70px 110px 120px",
                      background: "#FAFAF6",
                      borderBottom: "1px solid var(--color-hairline)",
                      color: "var(--color-ink-400)",
                    }}
                  >
                    <span>Description</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Unit price</span>
                    <span className="text-right">Total</span>
                  </div>

                  {/* Lines */}
                  {invoice.lineItems.map((item, i) => (
                    <div
                      key={item.id}
                      className="grid gap-3 items-center px-5 py-3 hover:bg-[#FCFAF6] transition-colors"
                      style={{
                        gridTemplateColumns: "1fr 70px 110px 120px",
                        borderBottom:
                          i < invoice.lineItems.length - 1
                            ? "1px solid var(--color-hairline)"
                            : "none",
                      }}
                    >
                      <div className="text-[13px] font-medium text-ink-900 leading-[1.3] tracking-[-0.005em]">
                        {item.description}
                      </div>
                      <div className="text-right text-[13px] text-ink-700 rd-tabular">
                        {item.quantity}
                      </div>
                      <div className="text-right text-[13px] text-ink-700 rd-tabular">
                        {sym}{fmt(item.unitPrice)}
                      </div>
                      <div className="text-right text-[13px] font-medium text-ink-900 rd-tabular">
                        {sym}{fmt(item.total)}
                      </div>
                    </div>
                  ))}
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
                        {sym}{fmt(invoice.subtotal)}
                      </span>
                    </div>
                    {invoice.discount > 0 && (
                      <div className="flex justify-between text-[12px]">
                        <span className="text-ink-500">Discount</span>
                        <span className="font-mono rd-tabular text-warn-fg">
                          −{sym}{fmt(invoice.discount)}
                        </span>
                      </div>
                    )}
                    {invoice.taxRate > 0 && (
                      <div className="flex justify-between text-[12px]">
                        <span className="text-ink-500">Tax ({invoice.taxRate}%)</span>
                        <span className="font-mono rd-tabular text-ink-700">
                          {sym}{fmt(invoice.tax)}
                        </span>
                      </div>
                    )}
                    <div
                      className="flex justify-between pt-2 mt-2"
                      style={{ borderTop: "1px solid var(--color-hairline)" }}
                    >
                      <span className="text-[13px] font-bold text-ink-900">Total</span>
                      <span className="font-mono rd-tabular text-[16px] font-bold text-accent-rd">
                        {sym}{fmt(invoice.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {invoice.notes && (
            <div>
              <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
                {"// NOTES"}
              </p>
              <div
                className="bg-card-rd rounded-[14px] p-5"
                style={{
                  border: "1px solid var(--color-hairline)",
                  boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
                }}
              >
                <div className="text-[12px] text-ink-700 whitespace-pre-wrap leading-[1.5]">
                  {invoice.notes}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
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
                  href={`/clients/${invoice.project.client.id}`}
                  className="text-[13px] font-medium text-ink-900 hover:text-accent-rd"
                >
                  {invoice.project.client.company}
                </Link>
              </div>

              <div>
                <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                  {"// PROJECT"}
                </div>
                <Link
                  href={`/projects/${invoice.project.id}?tab=invoice`}
                  className="text-[13px] font-medium text-ink-900 hover:text-accent-rd font-mono"
                >
                  {invoice.project.projectNumber}
                </Link>
                <div className="text-[12px] text-ink-500 mt-0.5">{invoice.project.title}</div>
              </div>

              {invoice.contactEmail && (
                <div>
                  <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                    {"// CONTACT EMAIL"}
                  </div>
                  <a
                    href={`mailto:${invoice.contactEmail}`}
                    className="text-[12px] text-ink-700 hover:text-accent-rd"
                  >
                    {invoice.contactEmail}
                  </a>
                </div>
              )}

              {invoice.issuedDate && (
                <div>
                  <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                    {"// ISSUED"}
                  </div>
                  <div className="text-[13px] text-ink-900">
                    {new Date(invoice.issuedDate).toLocaleDateString()}
                  </div>
                </div>
              )}

              {invoice.dueDate && (
                <div>
                  <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                    {"// DUE"}
                  </div>
                  <div className="text-[13px] text-ink-900 font-medium">
                    {new Date(invoice.dueDate).toLocaleDateString()}
                  </div>
                </div>
              )}

              {invoice.paidDate && (
                <div>
                  <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                    {"// PAID"}
                  </div>
                  <div
                    className="text-[13px] font-medium"
                    style={{ color: "var(--color-s-delivered-fg)" }}
                  >
                    {new Date(invoice.paidDate).toLocaleDateString()}
                  </div>
                </div>
              )}

              {invoice.exchangeRate && (
                <div>
                  <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                    {"// EXCHANGE RATE"}
                  </div>
                  <div className="text-[13px] text-ink-900 font-mono rd-tabular">
                    1 USD = {invoice.exchangeRate} CNY
                  </div>
                </div>
              )}

              {invoice.parentInvoice && (
                <div>
                  <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                    {"// ORIGINAL"}
                  </div>
                  <Link
                    href={`/invoices/${invoice.parentInvoice.id}`}
                    className="text-[13px] font-medium text-ink-900 hover:text-accent-rd font-mono"
                  >
                    {invoice.parentInvoice.invoiceNumber}
                  </Link>
                </div>
              )}

              {invoice.rmbDuplicate && (
                <div>
                  <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                    {"// RMB DUPLICATE"}
                  </div>
                  <Link
                    href={`/invoices/${invoice.rmbDuplicate.id}`}
                    className="text-[13px] font-medium text-ink-900 hover:text-accent-rd font-mono"
                  >
                    {invoice.rmbDuplicate.invoiceNumber}
                  </Link>
                </div>
              )}

              <div
                className="pt-3 mt-1"
                style={{ borderTop: "1px solid var(--color-hairline)" }}
              >
                <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                  {"// CREATED"}
                </div>
                <div className="text-[12px] text-ink-700">
                  {new Date(invoice.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
