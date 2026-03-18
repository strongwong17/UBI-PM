import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { generateEstimateNumber } from "@/lib/generate-number";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(["ADMIN", "MANAGER"]);
    if (isAuthError(authResult)) return authResult;
    const { userId } = authResult;

    const { id } = await params;
    const body = await request.json();
    const { exchangeRate, additionalTaxRate = 10 } = body;

    if (!exchangeRate || exchangeRate <= 0 || !isFinite(exchangeRate)) {
      return NextResponse.json(
        { error: "A valid exchange rate is required" },
        { status: 400 }
      );
    }
    if (additionalTaxRate < 0 || additionalTaxRate > 100 || !isFinite(additionalTaxRate)) {
      return NextResponse.json(
        { error: "Additional tax rate must be between 0 and 100" },
        { status: 400 }
      );
    }

    const original = await prisma.estimate.findUnique({
      where: { id },
      include: {
        phases: {
          include: { lineItems: { orderBy: { sortOrder: "asc" } } },
          orderBy: { sortOrder: "asc" },
        },
        rmbDuplicate: { select: { id: true } },
      },
    });

    if (!original) {
      return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    }

    if (original.rmbDuplicate) {
      return NextResponse.json(
        { error: "An RMB duplicate already exists for this estimate" },
        { status: 409 }
      );
    }

    const latestVersion = await prisma.estimate.findFirst({
      where: { projectId: original.projectId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const newVersion = (latestVersion?.version ?? original.version) + 1;
    const estimateNumber = await generateEstimateNumber();
    const combinedTaxRate = original.taxRate + additionalTaxRate;

    const rmbEstimate = await prisma.estimate.create({
      data: {
        estimateNumber,
        title: original.title,
        label: original.label ? `${original.label} (RMB)` : "RMB",
        version: newVersion,
        status: "DRAFT",
        isApproved: false,
        pricingModel: original.pricingModel,
        currency: "CNY",
        taxRate: combinedTaxRate,
        discount: Math.round(original.discount * exchangeRate * 100) / 100,
        notes: original.notes,
        clientNotes: original.clientNotes,
        validUntil: original.validUntil,
        exchangeRate,
        parentEstimateId: original.id,
        projectId: original.projectId,
        createdById: userId,
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
                unitPrice: Math.round(item.unitPrice * exchangeRate * 100) / 100,
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
        phases: {
          include: { lineItems: { orderBy: { sortOrder: "asc" } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    await logActivity({
      action: "GENERATE",
      entityType: "ESTIMATE",
      entityId: rmbEstimate.id,
      entityLabel: rmbEstimate.estimateNumber,
      description: `Generated RMB duplicate ${rmbEstimate.estimateNumber} from ${original.estimateNumber} (rate: ${exchangeRate})`,
      userId,
      projectId: original.projectId,
    });

    return NextResponse.json(rmbEstimate, { status: 201 });
  } catch (error) {
    console.error("Failed to create RMB estimate duplicate:", error);
    return NextResponse.json(
      { error: "Failed to create RMB duplicate" },
      { status: 500 }
    );
  }
}
