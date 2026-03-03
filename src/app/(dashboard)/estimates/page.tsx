import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Plus, Calculator } from "lucide-react";
import { currencySymbol } from "@/lib/currency";

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

  const estimates = await prisma.estimate.findMany({
    where,
    include: {
      project: { include: { client: true } },
      createdBy: { select: { name: true } },
      phases: { include: { lineItems: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const STATUSES = ["DRAFT", "SENT", "APPROVED", "REJECTED"];

  function calcTotal(estimate: (typeof estimates)[0]) {
    const subtotal = estimate.phases.reduce(
      (sum, phase) =>
        sum + phase.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0),
      0
    );
    return subtotal + subtotal * (estimate.taxRate / 100) - estimate.discount;
  }

  // Group by projectId
  const groupMap = new Map<
    string,
    { project: (typeof estimates)[0]["project"]; items: typeof estimates }
  >();
  for (const est of estimates) {
    const key = est.projectId;
    if (!groupMap.has(key)) {
      groupMap.set(key, { project: est.project, items: [] });
    }
    groupMap.get(key)!.items.push(est);
  }

  // Sort items within each group: newest version first
  for (const group of groupMap.values()) {
    group.items.sort((a, b) => b.version - a.version);
  }

  // Sort groups: most recent estimate activity first
  const groups = Array.from(groupMap.values()).sort((a, b) => {
    const aTime = Math.max(...a.items.map((e) => new Date(e.createdAt).getTime()));
    const bTime = Math.max(...b.items.map((e) => new Date(e.createdAt).getTime()));
    return bTime - aTime;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estimates</h1>
          <p className="text-gray-500 mt-1">Manage project estimates and quotes</p>
        </div>
        <Button asChild>
          <Link href="/estimates/new">
            <Plus className="h-4 w-4 mr-2" />
            New Estimate
          </Link>
        </Button>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm font-medium text-gray-500 mr-1">Status:</span>
        <Button size="sm" variant={!statusFilter ? "default" : "outline"} asChild>
          <Link href="/estimates">All</Link>
        </Button>
        {STATUSES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            asChild
          >
            <Link href={`/estimates?status=${s}`}>{s}</Link>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            All Estimates
            <Badge variant="secondary" className="ml-1">
              {estimates.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {estimates.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Calculator className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No estimates found</p>
              <p className="mt-1">
                {statusFilter
                  ? "Try a different status filter"
                  : "Create your first estimate"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map(({ project, items }) => (
                <div key={project.id} className="border rounded-lg overflow-hidden">
                  {/* Group header */}
                  <div className="flex items-center justify-between bg-gray-50 px-4 py-3 border-b">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-700">
                        {project.client.company}
                      </span>
                      <span className="text-gray-400">/</span>
                      <Link
                        href={`/projects/${project.id}?tab=estimates`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {project.projectNumber} — {project.title}
                      </Link>
                      <StatusBadge status={project.status} />
                    </div>
                    <Link
                      href={`/projects/${project.id}?tab=estimates`}
                      className="text-xs text-gray-500 hover:text-blue-600 shrink-0 ml-4"
                    >
                      View Project →
                    </Link>
                  </div>
                  {/* Version rows */}
                  <Table>
                    <TableBody>
                      {items.map((estimate) => {
                        const total = calcTotal(estimate);
                        const symbol = currencySymbol(estimate.currency);
                        return (
                          <TableRow key={estimate.id}>
                            <TableCell className="w-28">
                              <Badge variant="outline" className="font-mono text-xs">
                                {estimate.estimateNumber}
                              </Badge>
                            </TableCell>
                            <TableCell className="w-32">
                              <StatusBadge status={estimate.status} />
                            </TableCell>
                            <TableCell>
                              <Link
                                href={`/estimates/${estimate.id}`}
                                className="text-sm font-medium text-gray-800 hover:text-blue-600 hover:underline"
                              >
                                {estimate.title}
                              </Link>
                              {estimate.isApproved && (
                                <Badge className="ml-2 bg-green-100 text-green-800 border-green-300 text-xs">
                                  Approved
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium text-sm">
                              {symbol}
                              {total.toLocaleString("zh-CN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </TableCell>
                            <TableCell className="text-sm text-gray-500 w-28">
                              {new Date(estimate.updatedAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="w-32">
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="ghost" asChild>
                                  <Link href={`/estimates/${estimate.id}`}>View</Link>
                                </Button>
                                <Button size="sm" variant="ghost" asChild>
                                  <Link href={`/estimates/${estimate.id}/edit`}>Edit</Link>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
