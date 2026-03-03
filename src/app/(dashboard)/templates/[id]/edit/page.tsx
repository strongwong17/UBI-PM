import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { TemplateBuilder } from "@/components/templates/template-builder";

export default async function EditTemplatePage({
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/templates/${template.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Template</h1>
          <p className="text-sm text-gray-500 mt-0.5">{template.name}</p>
        </div>
      </div>

      <TemplateBuilder mode="edit" initialData={template} />
    </div>
  );
}
