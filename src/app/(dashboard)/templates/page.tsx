import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Layers, ChevronRight } from "lucide-react";

export default async function TemplatesPage() {
  const templates = await prisma.estimateTemplate.findMany({
    include: {
      _count: {
        select: { phases: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estimate Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Reusable templates to speed up estimate creation
          </p>
        </div>
        <Link href="/templates/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </Link>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Layers className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No templates yet</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
              Create reusable templates to quickly populate estimate phases and line items.
            </p>
            <Link href="/templates/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Template
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map((template) => (
            <Link key={template.id} href={`/templates/${template.id}`} className="block">
              <Card className="hover:shadow-sm transition-shadow cursor-pointer">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Layers className="h-5 w-5 text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 truncate">{template.name}</p>
                          {!template.isActive && (
                            <Badge variant="outline" className="text-xs text-gray-400">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        {template.description && (
                          <p className="text-sm text-gray-500 truncate mt-0.5">
                            {template.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant="secondary">{template.pricingModel}</Badge>
                      <span className="text-sm text-gray-500">
                        {template._count.phases} phase{template._count.phases !== 1 ? "s" : ""}
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
