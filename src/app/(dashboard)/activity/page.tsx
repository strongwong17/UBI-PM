import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { History, ChevronLeft, ChevronRight } from "lucide-react";
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

function actionStyle(action: string): { bg: string; fg: string } {
  switch (action) {
    case "CREATE":
    case "APPROVE":
      return { bg: "var(--color-s-approved-bg)", fg: "var(--color-s-approved-fg)" };
    case "DELETE":
      return { bg: "var(--color-warn-bg)", fg: "var(--color-warn-fg)" };
    case "UPDATE":
    case "STATUS_CHANGE":
    case "DUPLICATE":
    case "GENERATE":
    case "RESTORE":
    default:
      return { bg: "var(--color-canvas-cool)", fg: "var(--color-ink-700)" };
  }
}

function entityLink(entityType: string, entityId: string, projectId: string | null): string | null {
  switch (entityType) {
    case "PROJECT":
      return `/projects/${entityId}`;
    case "ESTIMATE":
      return `/estimates/${entityId}`;
    case "INVOICE":
      return `/invoices/${entityId}`;
    case "CLIENT":
      return `/clients/${entityId}`;
    case "INQUIRY":
      return projectId ? `/projects/${projectId}?tab=overview` : null;
    case "ATTACHMENT":
      return projectId ? `/projects/${projectId}` : null;
    default:
      return null;
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

  const role = (session.user as { role?: string }).role;
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

  const deleteLogIds = logs
    .filter(
      (l) =>
        l.action === "DELETE" && (l.entityType === "ESTIMATE" || l.entityType === "INVOICE"),
    )
    .map((l) => ({ entityType: l.entityType, entityId: l.entityId }));

  const restorableSet = new Set<string>();
  for (const { entityType, entityId } of deleteLogIds) {
    try {
      if (entityType === "ESTIMATE") {
        const est = await prisma.estimate.findUnique({
          where: { id: entityId },
          select: { deletedAt: true },
        });
        if (est?.deletedAt) restorableSet.add(entityId);
      } else if (entityType === "INVOICE") {
        const inv = await prisma.invoice.findUnique({
          where: { id: entityId },
          select: { deletedAt: true },
        });
        if (inv?.deletedAt) restorableSet.add(entityId);
      }
    } catch {
      // entity hard-deleted
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
      <div
        className="flex items-start justify-between gap-4 flex-wrap pb-[18px]"
        style={{ borderBottom: "1px solid var(--color-hairline)" }}
      >
        <div>
          <h1 className="text-[24px] font-bold tracking-[-0.025em] m-0 mb-1 text-ink-900">
            Activity
          </h1>
          <p className="text-[13px] text-ink-500 mt-0.5 font-mono tracking-[0.02em]">
            {"// "}{total} {total === 1 ? "entry" : "entries"} system-wide
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 w-12 shrink-0">
            Entity
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {entityTypeFilter && (
              <Link
                href={buildFilterUrl("entityType", "")}
                className="inline-flex items-center px-2.5 py-1 text-[12px] font-medium text-ink-500 hover:text-ink-700 rounded-md border border-dashed border-hairline hover:border-hairline-strong transition-colors"
              >
                Clear
              </Link>
            )}
            {ENTITY_CHIPS.map((chip) => (
              <Link
                key={chip.value}
                href={buildFilterUrl(
                  "entityType",
                  entityTypeFilter === chip.value ? "" : chip.value,
                )}
                className={cn(
                  "inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  entityTypeFilter === chip.value
                    ? "bg-ink-900 text-white"
                    : "bg-card-rd text-ink-700 border border-hairline hover:border-hairline-strong",
                )}
              >
                {chip.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 w-12 shrink-0">
            Action
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {actionFilter && (
              <Link
                href={buildFilterUrl("action", "")}
                className="inline-flex items-center px-2.5 py-1 text-[12px] font-medium text-ink-500 hover:text-ink-700 rounded-md border border-dashed border-hairline hover:border-hairline-strong transition-colors"
              >
                Clear
              </Link>
            )}
            {ACTION_CHIPS.map((chip) => (
              <Link
                key={chip.value}
                href={buildFilterUrl("action", actionFilter === chip.value ? "" : chip.value)}
                className={cn(
                  "inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  actionFilter === chip.value
                    ? "bg-ink-900 text-white"
                    : "bg-card-rd text-ink-700 border border-hairline hover:border-hairline-strong",
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
        <h2 className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
          {hasFilters ? "// FILTERED ACTIVITY" : "// ALL ACTIVITY"}
          {" · "}{total}
        </h2>

        {logs.length === 0 ? (
          <div
            className="bg-card-rd rounded-[14px] py-12 text-center"
            style={{
              border: "1px solid var(--color-hairline)",
              boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
            }}
          >
            <History className="h-10 w-10 mx-auto mb-3 text-ink-300" />
            <p className="font-medium text-ink-500">No activity found</p>
            <p className="text-sm text-ink-400 mt-1">
              {hasFilters
                ? "Try adjusting your filters"
                : "Actions will appear here as you use the system"}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => {
              const link = entityLink(log.entityType, log.entityId, log.projectId);
              const isRestorable = restorableSet.has(log.entityId);
              const isDeleteAction = log.action === "DELETE";
              const canRestore =
                isDeleteAction && (log.entityType === "ESTIMATE" || log.entityType === "INVOICE");
              const aStyle = actionStyle(log.action);

              return (
                <div
                  key={log.id}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 rounded-lg transition-colors duration-150",
                    isDeleteAction ? "bg-warn-bg/40" : "hover:bg-[#FCFAF6]",
                  )}
                >
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "var(--color-canvas-cool)" }}
                  >
                    <span className="text-[11px] font-semibold text-ink-700">
                      {log.user.name?.[0]?.toUpperCase() || "?"}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-medium text-ink-900">{log.user.name}</span>
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-[0.06em] uppercase"
                        style={{ background: aStyle.bg, color: aStyle.fg }}
                      >
                        {log.action.toLowerCase().replace(/_/g, " ")}
                      </span>
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-[0.06em] uppercase"
                        style={{
                          background: "var(--color-canvas-cool)",
                          color: "var(--color-ink-500)",
                          border: "1px solid var(--color-hairline-strong)",
                        }}
                      >
                        {log.entityType.toLowerCase()}
                      </span>
                    </div>
                    <p className="text-[13px] text-ink-700 mt-0.5 leading-relaxed">
                      {log.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {log.entityLabel && link && !isDeleteAction ? (
                        <Link
                          href={link}
                          className="text-[12px] text-ink-900 hover:text-accent-rd"
                        >
                          {log.entityLabel}
                        </Link>
                      ) : log.entityLabel ? (
                        <span
                          className={cn(
                            "text-[12px]",
                            isDeleteAction ? "text-warn-fg line-through" : "text-ink-400",
                          )}
                        >
                          {log.entityLabel}
                        </span>
                      ) : null}
                      {log.project && (
                        <>
                          {log.entityLabel && <span className="text-ink-300">·</span>}
                          <Link
                            href={`/projects/${log.project.id}`}
                            className="text-[12px] text-ink-400 hover:text-accent-rd font-mono transition-colors"
                          >
                            {log.project.projectNumber}
                          </Link>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 mt-0.5">
                    {canRestore && isRestorable && (
                      <RestoreButton
                        entityType={log.entityType}
                        entityId={log.entityId}
                        entityLabel={log.entityLabel || undefined}
                      />
                    )}
                    {canRestore && !isRestorable && (
                      <span className="text-[11px] text-ink-300 italic">gone</span>
                    )}
                    <span className="text-[12px] text-ink-400 w-20 text-right font-mono tracking-[0.02em]">
                      {timeAgo(log.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div
            className="flex items-center justify-between mt-6 pt-4"
            style={{ borderTop: "1px solid var(--color-hairline)" }}
          >
            <p className="text-[13px] text-ink-400 font-mono tracking-[0.02em]">
              {"// "}Page {page} of {totalPages} · {total} entries
            </p>
            <div className="flex gap-1.5">
              {page > 1 && (
                <Link
                  href={`/activity?${new URLSearchParams({
                    ...(entityTypeFilter ? { entityType: entityTypeFilter } : {}),
                    ...(actionFilter ? { action: actionFilter } : {}),
                    page: String(page - 1),
                  }).toString()}`}
                  className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd"
                  style={{
                    background: "var(--color-canvas-cool)",
                    border: "1px solid var(--color-hairline-strong)",
                  }}
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/activity?${new URLSearchParams({
                    ...(entityTypeFilter ? { entityType: entityTypeFilter } : {}),
                    ...(actionFilter ? { action: actionFilter } : {}),
                    page: String(page + 1),
                  }).toString()}`}
                  className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd"
                  style={{
                    background: "var(--color-canvas-cool)",
                    border: "1px solid var(--color-hairline-strong)",
                  }}
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
