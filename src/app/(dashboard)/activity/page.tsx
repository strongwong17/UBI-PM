import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";
import { RestoreButton } from "@/components/activity/restore-button";

const PAGE_SIZE = 20;

const ENTITY_TYPES = ["PROJECT", "ESTIMATE", "INVOICE", "CLIENT", "CONTRACT", "INQUIRY", "ATTACHMENT", "TEMPLATE"];
const ACTION_TYPES = ["CREATE", "UPDATE", "DELETE", "STATUS_CHANGE", "APPROVE", "DUPLICATE", "GENERATE", "RESTORE"];

function actionColor(action: string) {
  switch (action) {
    case "CREATE": return "bg-green-100 text-green-800";
    case "DELETE": return "bg-red-100 text-red-800";
    case "UPDATE": return "bg-blue-100 text-blue-800";
    case "STATUS_CHANGE": return "bg-purple-100 text-purple-800";
    case "APPROVE": return "bg-emerald-100 text-emerald-800";
    case "DUPLICATE": return "bg-amber-100 text-amber-800";
    case "GENERATE": return "bg-cyan-100 text-cyan-800";
    case "RESTORE": return "bg-indigo-100 text-indigo-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

function entityLink(entityType: string, entityId: string, projectId: string | null): string | null {
  switch (entityType) {
    case "PROJECT": return `/projects/${entityId}`;
    case "ESTIMATE": return `/estimates/${entityId}`;
    case "INVOICE": return `/invoices/${entityId}`;
    case "CLIENT": return `/clients/${entityId}`;
    case "CONTRACT": return `/contracts/${entityId}`;
    case "INQUIRY": return projectId ? `/projects/${projectId}?tab=brief` : null;
    case "ATTACHMENT": return projectId ? `/projects/${projectId}` : null;
    default: return null;
  }
}

function relativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
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

  // For DELETE actions, check if the entity is still soft-deleted (restorable)
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
    // Preserve the OTHER filter, clear the one being changed when value is empty
    if (key === "entityType") {
      if (value) p.set("entityType", value);
      // else: clearing entity filter — don't set it
      if (actionFilter) p.set("action", actionFilter);
    } else if (key === "action") {
      if (entityTypeFilter) p.set("entityType", entityTypeFilter);
      if (value) p.set("action", value);
      // else: clearing action filter — don't set it
    }
    const qs = p.toString();
    return `/activity${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
        <p className="text-gray-500 mt-1">Track all actions across the system</p>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium text-gray-500 mr-1 w-16">Entity:</span>
          <Button size="sm" variant={!entityTypeFilter ? "default" : "outline"} asChild>
            <Link href={buildFilterUrl("entityType", "")}>All</Link>
          </Button>
          {ENTITY_TYPES.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={entityTypeFilter === t ? "default" : "outline"}
              asChild
            >
              <Link href={buildFilterUrl("entityType", t)}>{t}</Link>
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium text-gray-500 mr-1 w-16">Action:</span>
          <Button size="sm" variant={!actionFilter ? "default" : "outline"} asChild>
            <Link href={buildFilterUrl("action", "")}>All</Link>
          </Button>
          {ACTION_TYPES.map((a) => (
            <Button
              key={a}
              size="sm"
              variant={actionFilter === a ? "default" : "outline"}
              asChild
            >
              <Link href={buildFilterUrl("action", a)}>{a}</Link>
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Activity
            <Badge variant="secondary" className="ml-1">{total}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <History className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No activity yet</p>
              <p className="mt-1">Actions will appear here as you use the system</p>
            </div>
          ) : (
            <div className="space-y-0">
              {logs.map((log) => {
                const link = entityLink(log.entityType, log.entityId, log.projectId);
                const isRestorable = restorableSet.has(log.entityId);
                const isDeleteAction = log.action === "DELETE";
                const canRestore = isDeleteAction && (log.entityType === "ESTIMATE" || log.entityType === "INVOICE");
                return (
                  <div
                    key={log.id}
                    className={`flex items-start gap-4 py-3 border-b last:border-b-0 ${isDeleteAction ? "bg-red-50/50" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">
                          {log.user.name}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${actionColor(log.action)}`}
                        >
                          {log.action}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {log.entityType}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700 mt-0.5">
                        {log.description}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        {log.entityLabel && link && !isDeleteAction ? (
                          <Link
                            href={link}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            {log.entityLabel}
                          </Link>
                        ) : log.entityLabel ? (
                          <span className={`text-xs ${isDeleteAction ? "text-red-500 line-through" : "text-gray-500"}`}>{log.entityLabel}</span>
                        ) : null}
                        {log.project && (
                          <Link
                            href={`/projects/${log.project.id}`}
                            className="text-xs text-gray-500 hover:text-blue-600 hover:underline"
                          >
                            {log.project.projectNumber}
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canRestore && isRestorable && (
                        <RestoreButton
                          entityType={log.entityType}
                          entityId={log.entityId}
                          entityLabel={log.entityLabel || undefined}
                        />
                      )}
                      {canRestore && !isRestorable && (
                        <span className="text-xs text-gray-400 italic">permanently deleted</span>
                      )}
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {relativeTime(log.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages} ({total} entries)
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Button size="sm" variant="outline" asChild>
                    <Link
                      href={`/activity?${new URLSearchParams({
                        ...(entityTypeFilter ? { entityType: entityTypeFilter } : {}),
                        ...(actionFilter ? { action: actionFilter } : {}),
                        page: String(page - 1),
                      }).toString()}`}
                    >
                      Previous
                    </Link>
                  </Button>
                )}
                {page < totalPages && (
                  <Button size="sm" variant="outline" asChild>
                    <Link
                      href={`/activity?${new URLSearchParams({
                        ...(entityTypeFilter ? { entityType: entityTypeFilter } : {}),
                        ...(actionFilter ? { action: actionFilter } : {}),
                        page: String(page + 1),
                      }).toString()}`}
                    >
                      Next
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
