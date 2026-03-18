import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, ArrowRight, FolderKanban } from "lucide-react";

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
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your clients and their contacts</p>
        </div>
        <Button asChild size="sm">
          <Link href="/clients/new">
            <Plus className="h-4 w-4 mr-1.5" />
            New Client
          </Link>
        </Button>
      </div>

      {/* Results */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            All clients
            <Badge variant="secondary" className="text-xs">{clients.length}</Badge>
          </h2>
        </div>

        {clients.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-500">No clients yet</p>
              <p className="text-sm text-gray-400 mt-1">Get started by adding your first client</p>
              <Button asChild className="mt-4" size="sm" variant="outline">
                <Link href="/clients/new">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Client
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1.5">
            {clients.map((client) => (
              <Link key={client.id} href={`/clients/${client.id}`} className="block group">
                <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-transparent hover:border-gray-200 hover:bg-gray-50/80 transition-all duration-150">
                  {/* Left */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-gray-500">
                        {client.company.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-gray-900 truncate block">
                        {client.company}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        {client.industry && (
                          <>
                            <span className="text-xs text-gray-400">{client.industry}</span>
                            <span className="text-gray-300">·</span>
                          </>
                        )}
                        {client.email && (
                          <span className="text-xs text-gray-400 truncate">{client.email}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <FolderKanban className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-500 tabular-nums">{client._count.projects}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-500 tabular-nums">{client._count.contacts}</span>
                    </div>
                    <span className="text-xs text-gray-400 w-16 text-right">
                      {new Date(client.createdAt).toLocaleDateString()}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
