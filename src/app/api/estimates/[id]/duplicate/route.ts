import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { generateEstimateNumber } from "@/lib/generate-number";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const original = await prisma.estimate.findUnique({
      where: { id },
      include: {
        phases: {
          include: { lineItems: { orderBy: { sortOrder: "asc" } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!original) {
      return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    }

    const latestVersion = await prisma.estimate.findFirst({
      where: { projectId: original.projectId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const newVersion = (latestVersion?.version ?? original.version) + 1;

    const estimateNumber = await generateEstimateNumber();

    const duplicate = await prisma.estimate.create({
      data: {
        estimateNumber,
        title: original.title,
        label: original.label,
        version: newVersion,
        status: "DRAFT",
        isApproved: false,
        pricingModel: original.pricingModel,
        currency: original.currency,
        taxRate: original.taxRate,
        discount: original.discount,
        notes: original.notes,
        clientNotes: original.clientNotes,
        validUntil: original.validUntil,
        projectId: original.projectId,
        createdById: (session.user as any).id,
        duplicatedFromId: original.id,
        phases: {
          create: original.phases.map((phase) => ({
            name: phase.name,
            description: phase.description,
            sortOrder: phase.sortOrder,
            lineItems: {
              create: phase.lineItems.map((item) => ({
                description: item.description,
                unit: item.unit,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                sortOrder: item.sortOrder,
                notes: item.notes,
                serviceModuleType: item.serviceModuleType,
                percentageBasis: item.percentageBasis,
                percentageRate: item.percentageRate,
                basisPhaseName: item.basisPhaseName,
                basisLineItemDesc: item.basisLineItemDesc,
              })),
            },
          })),
        },
      },
      include: {
        project: { include: { client: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        phases: {
          include: { lineItems: { orderBy: { sortOrder: "asc" } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    await logActivity({
      action: "DUPLICATE",
      entityType: "ESTIMATE",
      entityId: duplicate.id,
      entityLabel: duplicate.estimateNumber,
      description: `Duplicated estimate → ${duplicate.estimateNumber}`,
      userId: (session.user as any).id,
      projectId: duplicate.projectId,
    });

    return NextResponse.json(duplicate, { status: 201 });
  } catch (error) {
    console.error("Error duplicating estimate:", error);
    return NextResponse.json({ error: "Failed to duplicate estimate" }, { status: 500 });
  }
}
