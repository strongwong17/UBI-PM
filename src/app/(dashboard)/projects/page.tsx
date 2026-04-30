import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FolderKanban, Plus, Archive } from "lucide-react";
import { computeBillingState } from "@/lib/billing";
import { currencySymbol } from "@/lib/currency";
import { statusTokens } from "@/lib/redesign-tokens";

const STATUS_CHIPS: { value: string; label: string }[] = [
  { value: "ESTIMATING",  label: "Estimating" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "DELIVERED",   label: "Delivered" },
];

interface PageProps {
  searchParams: Promise<{ status?: string; view?: string }>;
}

export default async function ProjectsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const statusFilter = params.status || "";
  const view = params.view || "active";

  const where: Record<string, unknown> = {};
  if (statusFilter) {
    where.status = statusFilter;
  } else if (view === "archived") {
    where.status = "CLOSED";
  } else if (view === "active") {
    where.status = { not: "CLOSED" };
  }

  const [projects, archivedCount] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        client: true,
        primaryContact: { select: { name: true } },
        assignedTo: { select: { name: true } },
        _count: { select: { estimates: true } },
        estimates: {
          include: { phases: { include: { lineItems: true } } },
        },
        invoices: { where: { deletedAt: null } },
      },
      orderBy: { createdAt: "desc" },
    }),
    statusFilter ? Promise.resolve(0) : prisma.project.count({ where: { status: "CLOSED" } }),
  ]);

  // Derive active view for segmented control (ignore when status filter is set)
  const activeView = statusFilter ? "" : view;

  const heading = statusFilter
    ? `${statusFilter.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`
    : view === "archived"
    ? "Archived Projects"
    : view === "all"
    ? "All Projects"
    : "Active Projects";

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.025em] text-ink-900">Projects</h1>
          <p className="text-[13px] text-ink-500 mt-0.5 font-mono tracking-[0.02em]">{"// "}{projects.length} {view === "archived" ? "archived" : "active"}</p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-white"
          style={{
            background: "var(--color-accent-rd)",
            boxShadow: "0 4px 12px -2px rgba(217, 82, 43, 0.32)",
          }}
        >
          <Plus className="h-3.5 w-3.5" /> New project
        </Link>
      </div>

      {/* Filter area */}
      <div className="space-y-3">
        {/* Row 1: Segmented view control */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider w-10 shrink-0">View</span>
          <div className="inline-flex items-center rounded-lg bg-gray-100 p-0.5">
            {(
              [
                { value: "active", label: "Active", href: "/projects" },
                { value: "archived", label: `Archived${archivedCount > 0 ? ` (${archivedCount})` : ""}`, href: "/projects?view=archived" },
                { value: "all", label: "All", href: "/projects?view=all" },
              ] as const
            ).map((item) => (
              <Link
                key={item.value}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md transition-all duration-150",
                  activeView === item.value
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {item.value === "archived" && <Archive className="h-3 w-3" />}
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Row 2: Status filter chips */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider w-10 shrink-0">Filter</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {statusFilter && (
              <Link
                href="/projects"
                className="inline-flex items-center px-2.5 py-1 text-[12px] font-medium text-gray-500 hover:text-gray-700 rounded-full border border-dashed border-gray-300 hover:border-gray-400 transition-colors duration-150"
              >
                Clear
              </Link>
            )}
            {STATUS_CHIPS.map((chip) => (
              <Link
                key={chip.value}
                href={statusFilter === chip.value ? "/projects" : `/projects?status=${chip.value}`}
                className={cn(
                  "inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  statusFilter === chip.value
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
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderKanban className="h-4 w-4 text-gray-400" />
            {heading}
            <Badge variant="secondary" className="ml-1 text-xs">{projects.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FolderKanban className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No projects found</p>
              <p className="text-sm text-gray-400 mt-1">
                {statusFilter
                  ? "Try a different filter"
                  : view === "archived"
                  ? "No archived projects yet"
                  : "Create your first project to get started"}
              </p>
              {!statusFilter && view === "active" && (
                <Link
                  href="/projects/new"
                  className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd"
                  style={{
                    background: "var(--color-canvas-cool)",
                    border: "1px solid var(--color-hairline-strong)",
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> New project
                </Link>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Estimates</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => {
                  const billing = computeBillingState(project);
                  const pct = billing.estimated > 0 ? Math.min(100, (billing.invoiced / billing.estimated) * 100) : 0;
                  return (
                    <TableRow key={project.id} className={project.status === "CLOSED" ? "opacity-50" : ""}>
                      <TableCell>
                        <div className="flex gap-3">
                          <span className="w-1 h-9 rounded-full shrink-0" style={{ background: statusTokens(project.status).dot }} />
                          <div>
                            <Link href={`/projects/${project.id}`} className="font-mono text-[11px] text-ink-300 tracking-[0.04em] no-underline">
                              {project.projectNumber}
                            </Link>
                            <p className="text-[13px] font-medium text-ink-900 mt-0.5 truncate max-w-[260px]">{project.title}</p>
                            {billing.estimated > 0 && (
                              <div className="mt-1 max-w-[260px]">
                                <div className="font-mono text-[11px] text-ink-400">
                                  Invoiced <strong className="text-ink-700 font-semibold">{currencySymbol(billing.primaryCurrency)}{billing.invoiced.toLocaleString()}</strong> / {currencySymbol(billing.primaryCurrency)}{billing.estimated.toLocaleString()}
                                </div>
                                <div className="h-1 mt-1 bg-canvas-cool rounded">
                                  <div className="h-full rounded" style={{ width: `${pct}%`, background: "var(--color-s-delivered)" }} />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm">{project.client.company}</TableCell>
                      <TableCell className="text-sm text-gray-500">{project.primaryContact?.name || "-"}</TableCell>
                      <TableCell><StatusBadge status={project.status} /></TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{project._count.estimates}</Badge></TableCell>
                      <TableCell className="text-gray-500 text-sm">{project.assignedTo?.name || "-"}</TableCell>
                      <TableCell className="text-sm text-gray-400">{new Date(project.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
