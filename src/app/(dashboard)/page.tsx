import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Calculator,
  FolderKanban,
  Receipt,
  Clock,
  Users,
} from "lucide-react";

const PROJECT_STATUSES = [
  "INQUIRY_RECEIVED",
  "ESTIMATE_SENT",
  "APPROVED",
  "IN_PROGRESS",
  "COMPLETED",
  "INVOICED",
  "PAID",
  "CLOSED",
];

export default async function DashboardPage() {
  const session = await auth();

  const [
    projectCount,
    estimateCount,
    clientCount,
    invoiceCount,
    projectStatusCounts,
    activeProjects,
    recentEstimates,
    recentProjects,
  ] = await Promise.all([
    prisma.project.count(),
    prisma.estimate.count(),
    prisma.client.count(),
    prisma.invoice.count(),
    // Projects grouped by status
    prisma.project.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    // Active / in-progress projects
    prisma.project.findMany({
      where: { status: "IN_PROGRESS" },
      include: { client: { select: { company: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.estimate.findMany({
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { id: true, title: true, status: true, updatedAt: true },
    }),
    prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { id: true, projectNumber: true, title: true, status: true, updatedAt: true },
    }),
  ]);

  const stats = [
    { title: "Projects", value: projectCount, icon: FolderKanban, color: "text-purple-600", href: "/projects" },
    { title: "Estimates", value: estimateCount, icon: Calculator, color: "text-green-600", href: "/estimates" },
    { title: "Clients", value: clientCount, icon: Users, color: "text-blue-600", href: "/clients" },
    { title: "Invoices", value: invoiceCount, icon: Receipt, color: "text-orange-600", href: "/invoices" },
  ];

  const statusMap = Object.fromEntries(
    projectStatusCounts.map((s) => [s.status, s._count._all])
  );

  const activityItems = [
    ...recentEstimates.map((e) => ({
      id: e.id,
      label: e.title,
      type: "Estimate" as const,
      status: e.status,
      updatedAt: e.updatedAt,
      href: `/estimates/${e.id}`,
    })),
    ...recentProjects.map((p) => ({
      id: p.id,
      label: `${p.projectNumber} — ${p.title}`,
      type: "Project" as const,
      status: p.status,
      updatedAt: p.updatedAt,
      href: `/projects/${p.id}`,
    })),
  ]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {session?.user?.name}
        </h1>
        <p className="text-gray-500 mt-1">Here&apos;s an overview of your projects</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="hover:shadow-sm transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Pipeline */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-purple-500" />
              Project Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {PROJECT_STATUSES.map((status) => {
                const count = statusMap[status] || 0;
                const maxCount = Math.max(...Object.values(statusMap), 1);
                const pct = Math.round((count / maxCount) * 100);
                return (
                  <div key={status} className="flex items-center gap-3">
                    <div className="w-36 shrink-0">
                      <StatusBadge status={status} />
                    </div>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-400 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700 w-6 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Active Projects */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-blue-500" />
              In Progress
              {activeProjects.length > 0 && (
                <Badge variant="secondary" className="ml-auto">
                  {activeProjects.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeProjects.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No active projects
              </p>
            ) : (
              <div className="space-y-2">
                {activeProjects.map((project) => (
                  <Link key={project.id} href={`/projects/${project.id}`} className="block">
                    <div className="p-3 rounded-lg border hover:bg-blue-50 border-blue-100 transition-colors">
                      <p className="text-sm font-medium text-gray-900 truncate">{project.projectNumber}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{project.client.company}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-400" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activityItems.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
          ) : (
            <div className="space-y-2">
              {activityItems.map((item) => (
                <Link key={`${item.type}-${item.id}`} href={item.href} className="block">
                  <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant="outline" className="text-xs shrink-0">
                        {item.type}
                      </Badge>
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {item.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusBadge status={item.status} />
                      <span className="text-xs text-gray-400">
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
