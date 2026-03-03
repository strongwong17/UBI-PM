import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Edit } from "lucide-react";
import { TemplateDeleteButton } from "@/components/templates/template-delete-button";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const template = await prisma.estimateTemplate.findUnique({
    where: { id },
    include: {
      phases: {
        include: { lineItems: { orderBy: { sortOrder: "asc" } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!template) notFound();

  const estimatedTotal = template.phases.reduce(
    (sum, phase) =>
      sum + phase.lineItems.reduce((s, li) => s + li.defaultQuantity * li.defaultPrice, 0),
    0
  );

  const fmt = (n: number) =>
    n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/templates">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{template.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{template.pricingModel}</Badge>
              {!template.isActive && (
                <Badge variant="outline" className="text-gray-400">Inactive</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/templates/${template.id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <TemplateDeleteButton templateId={template.id} templateName={template.name} />
        </div>
      </div>

      {template.description && (
        <p className="text-gray-600">{template.description}</p>
      )}

      <div className="space-y-4">
        {template.phases.map((phase) => {
          const phaseTotal = phase.lineItems.reduce(
            (sum, li) => sum + li.defaultQuantity * li.defaultPrice,
            0
          );
          return (
            <Card key={phase.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{phase.name}</CardTitle>
                  <span className="text-sm font-semibold text-gray-700">
                    ${fmt(phaseTotal)}
                  </span>
                </div>
                {phase.description && (
                  <p className="text-sm text-gray-500">{phase.description}</p>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Default Qty</TableHead>
                      <TableHead className="text-right">Default Price</TableHead>
                      <TableHead className="text-right">Est. Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {phase.lineItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-sm">{item.description}</TableCell>
                        <TableCell className="text-sm text-gray-600">{item.unit}</TableCell>
                        <TableCell className="text-right text-sm">{item.defaultQuantity}</TableCell>
                        <TableCell className="text-right text-sm">
                          ${fmt(item.defaultPrice)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          ${fmt(item.defaultQuantity * item.defaultPrice)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="max-w-xs ml-auto">
            <Separator className="mb-4" />
            <div className="flex justify-between">
              <span className="font-semibold">Estimated Default Total</span>
              <span className="font-bold text-lg">${fmt(estimatedTotal)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
