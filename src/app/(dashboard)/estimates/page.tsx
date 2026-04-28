import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Plus, Calculator, ArrowRight } from "lucide-react";
import { currencySymbol } from "@/lib/currency";

const STATUS_CHIPS = [
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
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

export default async function EstimatesPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const statusFilter = params.status || "";

  const where: Record<string, unknown> = { deletedAt: null };
  if (statusFilter) where.status = statusFilter;

  const [estimates, statusCounts] = await Promise.all([
    prisma.estimate.findMany({
      where,
      include: {
        project: { include: { client: { select: { company: true } } } },
        createdBy: { select: { name: true } },
        phases: { include: { lineItems: { select: { quantity: true, unitPrice: true } } } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.estimate.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  const countMap = Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all]));

  function calcTotal(estimate: (typeof estimates)[0]) {
    const subtotal = estimate.phases.reduce(
      (sum, phase) => sum + phase.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0),
      0
    );
    const taxable = subtotal - (estimate.discount || 0);
    return taxable + taxable * (estimate.taxRate / 100);
  }

  const heading = statusFilter
    ? `${statusFilter.charAt(0) + statusFilter.slice(1).toLowerCase()} estimates`
    : "All estimates";

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.025em] text-ink-900">Estimates</h1>
          <p className="text-[13px] text-ink-500 mt-0.5 font-mono tracking-[0.02em]">// {estimates.length} {statusFilter ? statusFilter.toLowerCase() : "total"}</p>
        </div>
        <Button asChild size="sm">
          <Link href="/estimates/new">
            <Plus className="h-4 w-4 mr-1.5" />
            New Estimate
          </Link>
        </Button>
      </div>

      {/* Filter area — unified with projects page pattern */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-ink-400 uppercase tracking-wider w-10 shrink-0">Filter</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {statusFilter && (
            <Link
              href="/estimates"
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
                href={statusFilter === chip.value ? "/estimates" : `/estimates?status=${chip.value}`}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  statusFilter === chip.value
                    ? "bg-ink-900 text-white"
                    : "bg-card-rd text-ink-700 border border-hairline hover:border-hairline-strong",
                )}
              >
                {chip.label}
                {count > 0 && (
                  <span className={cn(
                    "text-[10px] tabular-nums",
                    statusFilter === chip.value ? "text-ink-300" : "text-ink-400"
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
            <Badge variant="secondary" className="text-xs">{estimates.length}</Badge>
          </h2>
        </div>

        {estimates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calculator className="h-10 w-10 mx-auto mb-3 text-ink-300" />
              <p className="font-medium text-ink-500">No estimates found</p>
              <p className="text-sm text-ink-400 mt-1">
                {statusFilter ? "Try a different filter" : "Create your first estimate to get started"}
              </p>
              {!statusFilter && (
                <Button asChild className="mt-4" size="sm" variant="outline">
                  <Link href="/estimates/new">
                    <Plus className="h-4 w-4 mr-1.5" />
                    New Estimate
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1.5">
            {estimates.map((estimate) => {
              const total = calcTotal(estimate);
              const sym = currencySymbol(estimate.currency);
              const isSentLong = estimate.status === "SENT" &&
                (Date.now() - new Date(estimate.updatedAt).getTime()) > 3 * 86400000;

              return (
                <Link key={estimate.id} href={`/estimates/${estimate.id}`} className="block group">
                  <div className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-lg border border-transparent transition-all duration-150",
                    "hover:border-hairline hover:bg-card-rd/80",
                    isSentLong && "bg-amber-50/50 border-amber-100 hover:border-amber-200 hover:bg-amber-50/80"
                  )}>
                    {/* Left: identity */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <StatusBadge status={estimate.status} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-ink-300 tracking-[0.04em] truncate">
                            {estimate.estimateNumber}
                          </span>
                          <span className="text-sm font-medium text-ink-900 truncate hidden sm:inline">
                            {estimate.title}
                          </span>
                          {estimate.isApproved && (
                            <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] py-0">
                              Approved
                            </Badge>
                          )}
                          {estimate.parentEstimateId && (
                            <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 py-0">
                              RMB
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-ink-400 truncate">
                            {estimate.project.client.company}
                          </span>
                          <span className="text-ink-300">·</span>
                          <span className="font-mono text-[11px] text-ink-300 tracking-[0.04em] truncate">
                            {estimate.project.projectNumber}
                          </span>
                          {isSentLong && (
                            <>
                              <span className="text-ink-300">·</span>
                              <span className="text-xs text-amber-600 font-medium">Needs follow-up</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: amount + time + arrow */}
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-sm font-semibold tabular-nums text-ink-900">
                        {sym}{total.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-xs text-ink-400 w-16 text-right">
                        {timeAgo(estimate.updatedAt)}
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
