import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import {
  Plus,
  ArrowRight,
  FolderKanban,
  Calculator,
  Receipt,
  Users,
  Clock,
  AlertCircle,
} from "lucide-react";

function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default async function DashboardPage() {
  const session = await auth();

  const [
    // Actionable counts
    estimatesSent,
    activeProjects,
    unpaidInvoices,
    newProjects,
    deliveredNeedInvoice,
    // Pipeline counts
    statusCounts,
    // Work queue items
    estimatingProjects,
    inProgressProjects,
    awaitingPaymentInvoices,
    // Recent activity
    recentActivity,
  ] = await Promise.all([
    // Estimates sent but not yet approved
    prisma.estimate.count({ where: { status: "SENT", isApproved: false, deletedAt: null } }),
    // Active projects
    prisma.project.count({ where: { status: "IN_PROGRESS" } }),
    // Unpaid invoices (SENT or OVERDUE)
    prisma.invoice.count({ where: { status: { in: ["SENT", "OVERDUE"] }, deletedAt: null } }),
    // New projects not yet briefed
    prisma.project.count({ where: { status: "NEW" } }),
    // Delivered but with uninvoiced work remaining (proxy: DELIVERED status)
    prisma.project.count({ where: { status: "DELIVERED" } }),
    // Pipeline
    prisma.project.groupBy({ by: ["status"], _count: { _all: true } }),
    // Work queue: projects in ESTIMATING (drafted estimates awaiting approval)
    prisma.project.findMany({
      where: { status: "ESTIMATING" },
      include: { client: { select: { company: true } } },
      orderBy: { updatedAt: "asc" },
      take: 5,
    }),
    // Work queue: projects in progress
    prisma.project.findMany({
      where: { status: "IN_PROGRESS" },
      include: { client: { select: { company: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    // Work queue: invoices awaiting payment (project status independent)
    prisma.invoice.findMany({
      where: { status: { in: ["SENT", "OVERDUE"] }, deletedAt: null },
      include: { project: { include: { client: { select: { company: true } } } } },
      orderBy: { updatedAt: "asc" },
      take: 5,
    }),
    // Recent activity log
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const statusMap = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count._all])
  );

  // Build summary text
  const summaryParts: string[] = [];
  if (estimatesSent > 0) summaryParts.push(`${estimatesSent} estimate${estimatesSent > 1 ? "s" : ""} awaiting response`);
  if (unpaidInvoices > 0) summaryParts.push(`${unpaidInvoices} invoice${unpaidInvoices > 1 ? "s" : ""} unpaid`);
  if (newProjects > 0) summaryParts.push(`${newProjects} new project${newProjects > 1 ? "s" : ""} to brief`);
  if (deliveredNeedInvoice > 0) summaryParts.push(`${deliveredNeedInvoice} delivered project${deliveredNeedInvoice > 1 ? "s" : ""} ready to invoice`);

  // Pipeline stages with CTAs (work-only, no billing state)
  const pipelineStages: { status: string; label: string; cta: string; href: string; color: string }[] = [
    { status: "NEW", label: "New", cta: "Brief", href: "/projects?status=NEW", color: "bg-gray-400" },
    { status: "BRIEFED", label: "Briefed", cta: "Estimate", href: "/projects?status=BRIEFED", color: "bg-slate-500" },
    { status: "ESTIMATING", label: "Estimating", cta: "Follow up", href: "/projects?status=ESTIMATING", color: "bg-blue-500" },
    { status: "APPROVED", label: "Approved", cta: "Start", href: "/projects?status=APPROVED", color: "bg-green-500" },
    { status: "IN_PROGRESS", label: "In progress", cta: "View", href: "/projects?status=IN_PROGRESS", color: "bg-indigo-500" },
    { status: "DELIVERED", label: "Delivered", cta: "Invoice", href: "/projects?status=DELIVERED", color: "bg-emerald-500" },
  ];

  // Work queue groups
  const estimatingItems = estimatingProjects.map((p) => ({
    id: p.id,
    href: `/projects/${p.id}`,
    status: p.status,
    projectNumber: p.projectNumber,
    title: p.title,
    company: p.client.company,
    updatedAt: p.updatedAt,
  }));
  const inProgressItems = inProgressProjects.map((p) => ({
    id: p.id,
    href: `/projects/${p.id}`,
    status: p.status,
    projectNumber: p.projectNumber,
    title: p.title,
    company: p.client.company,
    updatedAt: p.updatedAt,
  }));
  const awaitingPaymentItems = awaitingPaymentInvoices.map((inv) => ({
    id: inv.id,
    href: `/invoices/${inv.id}`,
    status: inv.status,
    projectNumber: inv.invoiceNumber,
    title: inv.project?.title ?? "(unknown project)",
    company: inv.project?.client.company ?? "—",
    updatedAt: inv.updatedAt,
  }));

  const workGroups = [
    {
      title: "Awaiting estimate approval",
      items: estimatingItems,
      emptyText: "No estimates pending response",
      actionLabel: "Follow up",
      color: "text-blue-600",
    },
    {
      title: "In progress",
      items: inProgressItems,
      emptyText: "No active projects",
      actionLabel: "Open",
      color: "text-indigo-600",
    },
    {
      title: "Awaiting payment",
      items: awaitingPaymentItems,
      emptyText: "No invoices pending",
      actionLabel: "View",
      color: "text-amber-600",
    },
  ];

  const totalWorkItems = estimatingItems.length + inProgressItems.length + awaitingPaymentItems.length;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* ─── Action bar ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {session?.user?.name ? `Hi, ${session.user.name}` : "Dashboard"}
          </h1>
          {summaryParts.length > 0 ? (
            <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              {summaryParts.join(" · ")}
            </p>
          ) : (
            <p className="text-sm text-gray-400 mt-0.5">All caught up</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/clients/new">
              <Users className="h-3.5 w-3.5 mr-1.5" />
              New Client
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/estimates/new">
              <Calculator className="h-3.5 w-3.5 mr-1.5" />
              New Estimate
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/projects/new">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Project
            </Link>
          </Button>
        </div>
      </div>

      {/* ─── Interactive metrics ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "New projects", count: newProjects, icon: FolderKanban, href: "/projects?status=NEW", color: "text-gray-600", bg: "bg-gray-50" },
          { label: "Estimates pending", count: estimatesSent, icon: Calculator, href: "/estimates?status=SENT", color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Active projects", count: activeProjects, icon: Clock, href: "/projects?status=IN_PROGRESS", color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Invoices unpaid", count: unpaidInvoices, icon: Receipt, href: "/invoices?status=SENT", color: "text-red-600", bg: "bg-red-50" },
        ].map((metric) => (
          <Link key={metric.label} href={metric.href}>
            <Card className={cn(
              "transition-all duration-150 cursor-pointer hover:shadow-md border",
              metric.count > 0 ? "hover:border-gray-300" : "opacity-60"
            )}>
              <CardContent className="py-4 px-4 flex items-center gap-3">
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", metric.bg)}>
                  <metric.icon className={cn("h-4 w-4", metric.color)} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold tracking-tight leading-none">{metric.count}</p>
                  <p className="text-xs text-gray-500 mt-1 truncate">{metric.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* ─── Main content: Work queue + Pipeline ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Work queue (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Work queue</h2>
            {totalWorkItems > 0 && (
              <Badge variant="secondary" className="text-xs">{totalWorkItems} items</Badge>
            )}
          </div>

          {totalWorkItems === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <FolderKanban className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm font-medium text-gray-500">No items need attention</p>
                <p className="text-xs text-gray-400 mt-1">Create a project to get started</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-5">
              {workGroups.map((group) => {
                if (group.items.length === 0) return null;
                return (
                  <div key={group.title}>
                    <p className={cn("text-xs font-medium mb-2", group.color)}>
                      {group.title}
                    </p>
                    <div className="space-y-1.5">
                      {group.items.map((item) => (
                        <Link key={item.id} href={item.href} className="block group">
                          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-transparent hover:border-gray-200 hover:bg-gray-50/80 transition-all duration-150">
                            <div className="flex items-center gap-3 min-w-0">
                              <StatusBadge status={item.status} />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {item.projectNumber}
                                  <span className="font-normal text-gray-500 ml-1.5">{item.title}</span>
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">{item.company}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs text-gray-400">{timeAgo(item.updatedAt)}</span>
                              <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pipeline + Activity (2 cols) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Actionable pipeline */}
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Pipeline</h2>
            <Card>
              <CardContent className="py-1 px-1">
                {pipelineStages.map((stage) => {
                  const count = statusMap[stage.status] || 0;
                  return (
                    <Link
                      key={stage.status}
                      href={stage.href}
                      className="flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-gray-50 transition-colors duration-150 group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn("h-2 w-2 rounded-full shrink-0", stage.color)} />
                        <span className="text-[13px] text-gray-700">{stage.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-[13px] font-semibold tabular-nums",
                          count > 0 ? "text-gray-900" : "text-gray-300"
                        )}>
                          {count}
                        </span>
                        {count > 0 && (
                          <span className="text-[11px] text-gray-400 group-hover:text-blue-600 transition-colors">
                            {stage.cta}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Recent activity */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">Recent activity</h2>
              <Link href="/activity" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                View all
              </Link>
            </div>
            <Card>
              <CardContent className="py-1 px-1">
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No activity yet</p>
                ) : (
                  <div>
                    {recentActivity.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-2.5 px-3 py-2 rounded-md"
                      >
                        <div className="h-5 w-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[10px] font-medium text-gray-500">
                            {log.user?.name?.[0]?.toUpperCase() || "?"}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] text-gray-600 leading-relaxed">
                            <span className="font-medium text-gray-800">{log.user?.name || "System"}</span>
                            {" "}
                            <span className="text-gray-500">{log.description}</span>
                          </p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(log.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
