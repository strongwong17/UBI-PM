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
import { FolderKanban, Plus } from "lucide-react";

const STATUSES = [
  "INQUIRY_RECEIVED","ESTIMATE_SENT","APPROVED","IN_PROGRESS",
  "COMPLETED","INVOICED","PAID","CLOSED",
];

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function ProjectsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const statusFilter = params.status || "";

  const where: Record<string, unknown> = {};
  if (statusFilter) where.status = statusFilter;

  const projects = await prisma.project.findMany({
    where,
    include: {
      client: true,
      primaryContact: { select: { name: true } },
      assignedTo: { select: { name: true } },
      _count: { select: { estimates: true } },
      invoices: { where: { deletedAt: null }, select: { id: true, status: true }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-500 mt-1">Manage all research projects</p>
        </div>
        <Button asChild size="sm">
          <Link href="/projects/new">
            <Plus className="h-4 w-4 mr-2" />New Project
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm font-medium text-gray-500 mr-1">Status:</span>
        <Button size="sm" variant={!statusFilter ? "default" : "outline"} asChild>
          <Link href="/projects">All</Link>
        </Button>
        {STATUSES.map((s) => (
          <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} asChild>
            <Link href={`/projects?status=${s}`}>{s.replace(/_/g, " ")}</Link>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5" />
            All Projects
            <Badge variant="secondary" className="ml-1">{projects.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FolderKanban className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No projects found</p>
              {!statusFilter && (
                <Button asChild className="mt-4" size="sm">
                  <Link href="/projects/new">New Project</Link>
                </Button>
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
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Link href={`/projects/${project.id}`} className="font-medium text-blue-600 hover:underline">
                        {project.projectNumber}
                      </Link>
                      <p className="text-sm text-gray-600 mt-0.5">{project.title}</p>
                    </TableCell>
                    <TableCell className="text-gray-600">{project.client.company}</TableCell>
                    <TableCell className="text-sm text-gray-500">{project.primaryContact?.name || "-"}</TableCell>
                    <TableCell><StatusBadge status={project.status} /></TableCell>
                    <TableCell><Badge variant="secondary">{project._count.estimates}</Badge></TableCell>
                    <TableCell className="text-gray-600 text-sm">{project.assignedTo?.name || "-"}</TableCell>
                    <TableCell className="text-sm text-gray-500">{new Date(project.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
