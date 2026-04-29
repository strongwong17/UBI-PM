import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
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
      <div>
        <Link
          href={`/templates/${template.id}`}
          className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900 mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to {template.name}
        </Link>
        <div
          className="flex items-start justify-between gap-4 flex-wrap pb-[18px]"
          style={{ borderBottom: "1px solid var(--color-hairline)" }}
        >
          <div>
            <h1 className="text-[24px] font-bold tracking-[-0.025em] m-0 mb-1 text-ink-900">
              Edit template
            </h1>
            <p className="text-[13px] text-ink-500 m-0 max-w-[520px]">
              Update phases and default line items for {template.name}.
            </p>
          </div>
        </div>
      </div>

      <TemplateBuilder mode="edit" initialData={template} />
    </div>
  );
}
