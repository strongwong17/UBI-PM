import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Users } from "lucide-react";

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    include: {
      _count: {
        select: {
          contacts: true,
          projects: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 mt-1">
            Manage your clients and their contacts
          </p>
        </div>
        <Link href="/clients/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Client
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Clients
            <Badge variant="secondary" className="ml-2">
              {clients.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No clients yet</p>
              <p className="mt-1">Get started by adding your first client.</p>
              <Link href="/clients/new" className="mt-4 inline-block">
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Client
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-center">Contacts</TableHead>
                  <TableHead className="text-center">Projects</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <Link
                        href={`/clients/${client.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {client.company}
                      </Link>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {client.industry || "-"}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {client.email || "-"}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {client.phone || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        {client._count.contacts}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        {client._count.projects}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {new Date(client.createdAt).toLocaleDateString()}
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
