import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { History, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { RestoreButton } from "@/components/activity/restore-button";

const PAGE_SIZE = 25;

const ENTITY_CHIPS = [
  { value: "PROJECT", label: "Project" },
  { value: "ESTIMATE", label: "Estimate" },
  { value: "INVOICE", label: "Invoice" },
  { value: "CLIENT", label: "Client" },
  { value: "INQUIRY", label: "Inquiry" },
  { value: "ATTACHMENT", label: "Attachment" },
];

const ACTION_CHIPS = [
  { value: "CREATE", label: "Create" },
  { value: "UPDATE", label: "Update" },
  { value: "DELETE", label: "Delete" },
  { value: "STATUS_CHANGE", label: "Status change" },
  { value: "APPROVE", label: "Approve" },
  { value: "DUPLICATE", label: "Duplicate" },
  { value: "GENERATE", label: "Generate" },
  { value: "RESTORE", label: "Restore" },
];

function actionColor(action: string) {
  switch (action) {
    case "CREATE": return "bg-green-50 text-green-700 border-green-200";
    case "DELETE": return "bg-red-50 text-red-700 border-red-200";
    case "UPDATE": return "bg-blue-50 text-blue-700 border-blue-200";
    case "STATUS_CHANGE": return "bg-purple-50 text-purple-700 border-purple-200";
    case "APPROVE": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "DUPLICATE": return "bg-amber-50 text-amber-700 border-amber-200";
    case "GENERATE": return "bg-cyan-50 text-cyan-700 border-cyan-200";
    case "RESTORE": return "bg-indigo-50 text-indigo-700 border-indigo-200";
    default: return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

function entityLink(entityType: string, entityId: string, projectId: string | null): string | null {
  switch (entityType) {
    case "PROJECT": return `/projects/${entityId}`;
    case "ESTIMATE": return `/estimates/${entityId}`;
    case "INVOICE": return `/invoices/${entityId}`;
    case "CLIENT": return `/clients/${entityId}`;
    case "INQUIRY": return projectId ? `/projects/${projectId}?tab=overview` : null;
    case "ATTACHMENT": return projectId ? `/projects/${projectId}` : null;
    default: return null;
  }
}

function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

interface PageProps {
  searchParams: Promise<{ entityType?: string; action?: string; page?: string }>;
}

export default async function ActivityPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = (session.user as any).role;
  if (role !== "ADMIN" && role !== "MANAGER") redirect("/");

  const params = await searchParams;
  const entityTypeFilter = params.entityType || "";
  const actionFilter = params.action || "";
  const page = parseInt(params.page || "1", 10);

  const where: Record<string, unknown> = {};
  if (entityTypeFilter) where.entityType = entityTypeFilter;
  if (actionFilter) where.action = actionFilter;

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        project: { select: { id: true, projectNumber: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.activityLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Check which deleted entities are restorable
  const deleteLogIds = logs
    .filter((l) => l.action === "DELETE" && (l.entityType === "ESTIMATE" || l.entityType === "INVOICE"))
    .map((l) => ({ entityType: l.entityType, entityId: l.entityId }));

  const restorableSet = new Set<string>();
  for (const { entityType, entityId } of deleteLogIds) {
    try {
      if (entityType === "ESTIMATE") {
        const est = await prisma.estimate.findUnique({ where: { id: entityId }, select: { deletedAt: true } });
        if (est?.deletedAt) restorableSet.add(entityId);
      } else if (entityType === "INVOICE") {
        const inv = await prisma.invoice.findUnique({ where: { id: entityId }, select: { deletedAt: true } });
        if (inv?.deletedAt) restorableSet.add(entityId);
      }
    } catch {
      // Entity may have been hard-deleted
    }
  }

  function buildFilterUrl(key: string, value: string) {
    const p = new URLSearchParams();
    if (key === "entityType") {
      if (value) p.set("entityType", value);
      if (actionFilter) p.set("action", actionFilter);
    } else if (key === "action") {
      if (entityTypeFilter) p.set("entityType", entityTypeFilter);
      if (value) p.set("action", value);
    }
    const qs = p.toString();
    return `/activity${qs ? `?${qs}` : ""}`;
  }

  const hasFilters = entityTypeFilter || actionFilter;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Activity</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track all actions across the system</p>
      </div>

      {/* Filter area — unified pattern */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider w-12 shrink-0">Entity</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {entityTypeFilter && (
              <Link
                href={buildFilterUrl("entityType", "")}
                className="inline-flex items-center px-2.5 py-1 text-[12px] font-medium text-gray-500 hover:text-gray-700 rounded-full border border-dashed border-gray-300 hover:border-gray-400 transition-colors duration-150"
              >
                Clear
              </Link>
            )}
            {ENTITY_CHIPS.map((chip) => (
              <Link
                key={chip.value}
                href={buildFilterUrl("entityType", entityTypeFilter === chip.value ? "" : chip.value)}
                className={cn(
                  "inline-flex items-center px-2.5 py-1 text-[12px] font-medium rounded-full border transition-all duration-150",
                  entityTypeFilter === chip.value
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-800"
                )}
              >
                {chip.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider w-12 shrink-0">Action</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {actionFilter && (
              <Link
                href={buildFilterUrl("action", "")}
                className="inline-flex items-center px-2.5 py-1 text-[12px] font-medium text-gray-500 hover:text-gray-700 rounded-full border border-dashed border-gray-300 hover:border-gray-400 transition-colors duration-150"
              >
                Clear
              </Link>
            )}
            {ACTION_CHIPS.map((chip) => (
              <Link
                key={chip.value}
                href={buildFilterUrl("action", actionFilter === chip.value ? "" : chip.value)}
                className={cn(
                  "inline-flex items-center px-2.5 py-1 text-[12px] font-medium rounded-full border transition-all duration-150",
                  actionFilter === chip.value
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-800"
                )}
              >
                {chip.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            {hasFilters ? "Filtered activity" : "All activity"}
            <Badge variant="secondary" className="text-xs">{total}</Badge>
          </h2>
        </div>

        {logs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <History className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-500">No activity found</p>
              <p className="text-sm text-gray-400 mt-1">
                {hasFilters ? "Try adjusting your filters" : "Actions will appear here as you use the system"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => {
              const link = entityLink(log.entityType, log.entityId, log.projectId);
              const isRestorable = restorableSet.has(log.entityId);
              const isDeleteAction = log.action === "DELETE";
              const canRestore = isDeleteAction && (log.entityType === "ESTIMATE" || log.entityType === "INVOICE");

              return (
                <div
                  key={log.id}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 rounded-lg transition-colors duration-150",
                    isDeleteAction ? "bg-red-50/40" : "hover:bg-gray-50/80"
                  )}
                >
                  {/* Avatar */}
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[11px] font-semibold text-gray-500">
                      {log.user.name?.[0]?.toUpperCase() || "?"}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-medium text-gray-900">
                        {log.user.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] py-0 px-1.5 font-medium", actionColor(log.action))}
                      >
                        {log.action.toLowerCase().replace(/_/g, " ")}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-gray-500">
                        {log.entityType.toLowerCase()}
                      </Badge>
                    </div>
                    <p className="text-[13px] text-gray-600 mt-0.5 leading-relaxed">
                      {log.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {log.entityLabel && link && !isDeleteAction ? (
                        <Link href={link} className="text-[12px] text-blue-600 hover:underline">
                          {log.entityLabel}
                        </Link>
                      ) : log.entityLabel ? (
                        <span className={cn("text-[12px]", isDeleteAction ? "text-red-500 line-through" : "text-gray-400")}>
                          {log.entityLabel}
                        </span>
                      ) : null}
                      {log.project && (
                        <>
                          {log.entityLabel && <span className="text-gray-300">·</span>}
                          <Link
                            href={`/projects/${log.project.id}`}
                            className="text-[12px] text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            {log.project.projectNumber}
                          </Link>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: time + restore */}
                  <div className="flex items-center gap-2 shrink-0 mt-0.5">
                    {canRestore && isRestorable && (
                      <RestoreButton
                        entityType={log.entityType}
                        entityId={log.entityId}
                        entityLabel={log.entityLabel || undefined}
                      />
                    )}
                    {canRestore && !isRestorable && (
                      <span className="text-[11px] text-gray-300 italic">gone</span>
                    )}
                    <span className="text-[12px] text-gray-400 w-20 text-right">
                      {timeAgo(log.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
            <p className="text-[13px] text-gray-400">
              Page {page} of {totalPages}
              <span className="text-gray-300 ml-1">({total} entries)</span>
            </p>
            <div className="flex gap-1.5">
              {page > 1 && (
                <Button size="sm" variant="outline" className="h-8 px-3" asChild>
                  <Link
                    href={`/activity?${new URLSearchParams({
                      ...(entityTypeFilter ? { entityType: entityTypeFilter } : {}),
                      ...(actionFilter ? { action: actionFilter } : {}),
                      page: String(page - 1),
                    }).toString()}`}
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                    Previous
                  </Link>
                </Button>
              )}
              {page < totalPages && (
                <Button size="sm" variant="outline" className="h-8 px-3" asChild>
                  <Link
                    href={`/activity?${new URLSearchParams({
                      ...(entityTypeFilter ? { entityType: entityTypeFilter } : {}),
                      ...(actionFilter ? { action: actionFilter } : {}),
                      page: String(page + 1),
                    }).toString()}`}
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
