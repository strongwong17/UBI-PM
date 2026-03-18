import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EstimateBuilder } from "@/components/estimates/estimate-builder";

export default async function EditEstimatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const estimate = await prisma.estimate.findUnique({
    where: { id },
    include: {
      phases: {
        include: { lineItems: { orderBy: { sortOrder: "asc" } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!estimate) notFound();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Estimate</h1>
        <p className="text-sm text-gray-500 mt-0.5">{estimate.title}</p>
      </div>
      <EstimateBuilder
        mode="edit"
        initialData={{
          id: estimate.id,
          title: estimate.title,
          label: estimate.label,
          projectName: estimate.projectName,
          address: estimate.address,
          projectId: estimate.projectId,
          pricingModel: estimate.pricingModel,
          currency: estimate.currency,
          taxRate: estimate.taxRate,
          discount: estimate.discount,
          notes: estimate.notes,
          clientNotes: estimate.clientNotes,
          validUntil: estimate.validUntil ? estimate.validUntil.toISOString() : null,
          phases: estimate.phases.map((p) => ({
            name: p.name,
            description: p.description,
            sortOrder: p.sortOrder,
            lineItems: p.lineItems.map((li) => ({
              description: li.description,
              unit: li.unit,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
              sortOrder: li.sortOrder,
              notes: li.notes,
              percentageBasis: li.percentageBasis,
              percentageRate: li.percentageRate,
              basisPhaseName: li.basisPhaseName,
              basisLineItemDesc: li.basisLineItemDesc,
            })),
          })),
        }}
      />
    </div>
  );
}
