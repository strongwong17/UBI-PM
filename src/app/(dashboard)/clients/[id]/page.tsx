import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Edit,
  Mail,
  Phone,
  Building2,
  MessageCircle,
  Star,
  StickyNote,
  Calendar,
  Users,
  FolderKanban,
  Receipt,
  CreditCard,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { ClientDeleteButton } from "@/components/clients/client-delete-button";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const isAdmin = (session?.user as { role?: string })?.role === "ADMIN";
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      contacts: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      projects: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          invoices: { where: { deletedAt: null }, select: { id: true, status: true }, take: 1 },
          _count: { select: { estimates: true } },
        },
      },
      _count: {
        select: {
          contacts: true,
          projects: true,
        },
      },
    },
  });

  if (!client) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/clients">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{client.company}</h1>
            {client.industry && (
              <p className="text-gray-500 mt-1 flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                {client.industry}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/clients/${client.id}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          {isAdmin && (
            <ClientDeleteButton clientId={client.id} clientName={client.company} />
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "Contacts", value: client._count.contacts, icon: Users },
          { label: "Projects", value: client._count.projects, icon: FolderKanban },
          {
            label: "Invoices",
            value: client.projects.filter((p) => p.invoices.length > 0).length,
            icon: Receipt,
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <stat.icon className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-500">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Info */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Client Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {client.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                <a
                  href={`mailto:${client.email}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {client.email}
                </a>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="text-sm">{client.phone}</span>
              </div>
            )}
            {client.wechatId && (
              <div className="flex items-center gap-3">
                <MessageCircle className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="text-sm">{client.wechatId}</span>
              </div>
            )}

            {(client.billingName || client.billingEmail || client.billingAddress || client.billingPhone || client.taxId) && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-gray-400" />
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Billing</span>
                  </div>
                  {client.billingName && (
                    <p className="text-sm font-medium">{client.billingName}</p>
                  )}
                  {client.billingAddress && (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{client.billingAddress}</p>
                  )}
                  {client.billingEmail && (
                    <a href={`mailto:${client.billingEmail}`} className="text-sm text-blue-600 hover:underline block">
                      {client.billingEmail}
                    </a>
                  )}
                  {client.billingPhone && (
                    <p className="text-sm text-gray-600">{client.billingPhone}</p>
                  )}
                  {client.taxId && (
                    <p className="text-sm text-gray-600">Tax ID: {client.taxId}</p>
                  )}
                </div>
              </>
            )}

            {client.notes && (
              <>
                <Separator />
                <div className="flex gap-3">
                  <StickyNote className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {client.notes}
                  </p>
                </div>
              </>
            )}
            <Separator />
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-500">
                Created {new Date(client.createdAt).toLocaleDateString()}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Contacts */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Contacts
              <Badge variant="secondary">{client.contacts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {client.contacts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">
                No contacts added yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {client.contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {contact.name}
                          {contact.isPrimary && (
                            <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {contact.title || "-"}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {contact.email ? (
                          <a
                            href={`mailto:${contact.email}`}
                            className="text-blue-600 hover:underline"
                          >
                            {contact.email}
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {contact.phone || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Projects */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Recent Projects
            <Badge variant="secondary">{client._count.projects}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {client.projects.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">
              No projects yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Estimates</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {project.projectNumber}
                      </Link>
                      <p className="text-sm text-gray-600 mt-0.5">{project.title}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={project.status} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{project._count.estimates}</Badge>
                    </TableCell>
                    <TableCell>
                      {project.invoices.length > 0 ? (
                        <Link href={`/invoices/${project.invoices[0].id}`}>
                          <StatusBadge status={project.invoices[0].status} />
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </TableCell>
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
