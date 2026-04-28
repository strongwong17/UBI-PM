import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Receipt, ArrowRight } from "lucide-react";
import { currencySymbol } from "@/lib/currency";

const STATUS_CHIPS = [
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
];

function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function InvoicesPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const statusFilter = params.status || "";

  const where: Record<string, unknown> = { deletedAt: null };
  if (statusFilter) where.status = statusFilter;

  const [invoices, statusCounts, outstandingAgg] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            projectNumber: true,
            title: true,
            client: { select: { id: true, company: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoice.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.invoice.aggregate({
      where: { status: { in: ["SENT", "OVERDUE"] }, deletedAt: null },
      _sum: { total: true },
      _count: { _all: true },
    }),
  ]);

  const countMap = Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all]));
  const outstandingTotal = outstandingAgg._sum.total || 0;
  const outstandingCount = outstandingAgg._count._all || 0;

  const heading = statusFilter
    ? `${statusFilter.charAt(0) + statusFilter.slice(1).toLowerCase()} invoices`
    : "All invoices";

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.025em] text-ink-900">Invoices</h1>
          <p className="text-[13px] text-ink-500 mt-0.5 font-mono tracking-[0.02em]">// {invoices.length} {statusFilter ? statusFilter.toLowerCase() : "total"}</p>
        </div>
        {outstandingTotal > 0 && (
          <div className="text-right">
            <p className="text-xs text-ink-400">Outstanding</p>
            <p className="text-lg font-bold text-orange-600 tabular-nums">
              ${outstandingTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-ink-400">{outstandingCount} invoice{outstandingCount !== 1 ? "s" : ""}</p>
          </div>
        )}
      </div>

      {/* Filter area — unified pattern */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-ink-400 uppercase tracking-wider w-10 shrink-0">Filter</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {statusFilter && (
            <Link
              href="/invoices"
              className="inline-flex items-center px-2.5 py-1 text-[12px] font-medium text-ink-500 hover:text-ink-700 rounded-md border border-dashed border-hairline hover:border-hairline-strong transition-colors duration-150"
            >
              Clear
            </Link>
          )}
          {STATUS_CHIPS.map((chip) => {
            const count = countMap[chip.value] || 0;
            return (
              <Link
                key={chip.value}
                href={statusFilter === chip.value ? "/invoices" : `/invoices?status=${chip.value}`}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  statusFilter === chip.value
                    ? "bg-ink-900 text-white"
                    : chip.value === "OVERDUE" && count > 0
                    ? "bg-red-50 text-red-700 border border-red-200 hover:border-red-400"
                    : "bg-card-rd text-ink-700 border border-hairline hover:border-hairline-strong",
                )}
              >
                {chip.label}
                {count > 0 && (
                  <span className={cn(
                    "text-[10px] tabular-nums",
                    statusFilter === chip.value ? "text-ink-300" : chip.value === "OVERDUE" ? "text-red-500" : "text-ink-400"
                  )}>
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Results */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-ink-900 flex items-center gap-2">
            {heading}
            <Badge variant="secondary" className="text-xs">{invoices.length}</Badge>
          </h2>
        </div>

        {invoices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Receipt className="h-10 w-10 mx-auto mb-3 text-ink-300" />
              <p className="font-medium text-ink-500">No invoices found</p>
              <p className="text-sm text-ink-400 mt-1">
                {statusFilter ? "Try a different filter" : "Invoices are created through the project completion flow"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1.5">
            {invoices.map((invoice) => {
              const sym = currencySymbol(invoice.currency);
              const isOverdue = invoice.status === "OVERDUE";
              const isUnpaid = invoice.status === "SENT";

              return (
                <Link key={invoice.id} href={`/invoices/${invoice.id}`} className="block group">
                  <div className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-lg border border-transparent transition-all duration-150",
                    "hover:border-hairline hover:bg-card-rd/80",
                    isOverdue && "bg-red-50/50 border-red-100 hover:border-red-200 hover:bg-red-50/80",
                  )}>
                    {/* Left */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <StatusBadge status={invoice.status} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-ink-300 tracking-[0.04em]">
                            {invoice.invoiceNumber}
                          </span>
                          {invoice.parentInvoiceId && (
                            <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 py-0">
                              RMB
                            </Badge>
                          )}
                          {invoice.currency !== "USD" && !invoice.parentInvoiceId && (
                            <Badge variant="outline" className="text-[10px] py-0">{invoice.currency}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-ink-400 truncate">
                            {invoice.project.client.company}
                          </span>
                          <span className="text-ink-300">·</span>
                          <span className="font-mono text-[11px] text-ink-300 tracking-[0.04em] truncate">
                            {invoice.project.projectNumber}
                          </span>
                          {isOverdue && (
                            <>
                              <span className="text-ink-300">·</span>
                              <span className="text-xs text-red-600 font-medium">Overdue</span>
                            </>
                          )}
                          {isUnpaid && invoice.dueDate && new Date(invoice.dueDate) < new Date() && (
                            <>
                              <span className="text-ink-300">·</span>
                              <span className="text-xs text-orange-600 font-medium">Past due</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right */}
                    <div className="flex items-center gap-4 shrink-0">
                      <span className={cn(
                        "text-sm font-semibold tabular-nums",
                        isOverdue ? "text-red-700" : "text-ink-900"
                      )}>
                        {sym}{invoice.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs text-ink-400 w-16 text-right">
                        {invoice.issuedDate ? timeAgo(new Date(invoice.issuedDate)) : "Draft"}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-ink-300 group-hover:text-ink-500 transition-colors" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
