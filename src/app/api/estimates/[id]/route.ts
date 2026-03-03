import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const estimate = await prisma.estimate.findUnique({
      where: { id },
      include: {
        project: { include: { client: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        phases: {
          include: { lineItems: { orderBy: { sortOrder: "asc" } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!estimate) {
      return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    }

    return NextResponse.json(estimate);
  } catch (error) {
    console.error("Error fetching estimate:", error);
    return NextResponse.json({ error: "Failed to fetch estimate" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      title,
      label,
      projectName,
      address,
      pricingModel,
      currency,
      taxRate,
      discount,
      notes,
      clientNotes,
      validUntil,
      phases,
    } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Estimate title is required" }, { status: 400 });
    }

    const existing = await prisma.estimate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    }

    const estimate = await prisma.$transaction(async (tx) => {
      // Delete line items first, then phases (SQLite cascade may not fire in deleteMany)
      const phaseIds = (await tx.estimatePhase.findMany({ where: { estimateId: id }, select: { id: true } })).map(p => p.id);
      if (phaseIds.length > 0) {
        await tx.estimateLineItem.deleteMany({ where: { phaseId: { in: phaseIds } } });
      }
      await tx.estimatePhase.deleteMany({ where: { estimateId: id } });

      return tx.estimate.update({
        where: { id },
        data: {
          title: title.trim(),
          label: label !== undefined ? (label?.trim() || null) : existing.label,
          projectName: projectName?.trim() ?? existing.projectName,
          address: address?.trim() ?? existing.address,
          pricingModel: pricingModel || existing.pricingModel,
          currency: currency || existing.currency,
          taxRate: taxRate ?? existing.taxRate,
          discount: discount ?? existing.discount,
          notes: notes?.trim() ?? existing.notes,
          clientNotes: clientNotes?.trim() ?? existing.clientNotes,
          validUntil: validUntil ? new Date(validUntil) : existing.validUntil,
          phases:
            phases && phases.length > 0
              ? {
                  create: phases.map(
                    (
                      phase: {
                        name: string;
                        description?: string;
                        sortOrder?: number;
                        lineItems?: {
                          description: string;
                          unit?: string;
                          quantity?: number;
                          unitPrice: number;
                          sortOrder?: number;
                          notes?: string;
                          percentageBasis?: string | null;
                          percentageRate?: number | null;
                          basisPhaseName?: string | null;
                          basisLineItemDesc?: string | null;
                        }[];
                      },
                      index: number
                    ) => ({
                      name: phase.name,
                      description: phase.description || null,
                      sortOrder: phase.sortOrder ?? index,
                      lineItems:
                        phase.lineItems && phase.lineItems.length > 0
                          ? {
                              create: phase.lineItems.map((item, itemIndex) => ({
                                description: item.description,
                                unit: item.unit || "hours",
                                quantity: item.quantity ?? 1,
                                unitPrice: item.unitPrice,
                                sortOrder: item.sortOrder ?? itemIndex,
                                notes: item.notes || null,
                                percentageBasis: item.percentageBasis || null,
                                percentageRate: item.percentageRate ?? null,
                                basisPhaseName: item.basisPhaseName || null,
                                basisLineItemDesc: item.basisLineItemDesc || null,
                              })),
                            }
                          : undefined,
                    })
                  ),
                }
              : undefined,
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
    });

    await logActivity({
      action: "UPDATE",
      entityType: "ESTIMATE",
      entityId: id,
      entityLabel: estimate.estimateNumber,
      description: `Updated estimate ${estimate.estimateNumber}`,
      userId: (session.user as any).id,
      projectId: estimate.projectId,
    });

    return NextResponse.json(estimate);
  } catch (error) {
    console.error("Error updating estimate:", error);
    const message = error instanceof Error ? error.message : "Failed to update estimate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.estimate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Clear invoice reference to this estimate
      await tx.invoice.updateMany({
        where: { estimateId: id },
        data: { estimateId: null },
      });
      // Clear duplicatedFromId on copies
      await tx.estimate.updateMany({
        where: { duplicatedFromId: id },
        data: { duplicatedFromId: null },
      });
      // Soft delete
      await tx.estimate.update({
        where: { id },
        data: { deletedAt: new Date(), isApproved: false },
      });
    });

    await logActivity({
      action: "DELETE",
      entityType: "ESTIMATE",
      entityId: id,
      entityLabel: existing.estimateNumber,
      description: `Deleted estimate ${existing.estimateNumber}`,
      userId: (session.user as any).id,
      projectId: existing.projectId,
    });

    return NextResponse.json({ message: "Estimate deleted successfully" });
  } catch (error) {
    console.error("Error deleting estimate:", error);
    const message = error instanceof Error ? error.message : "Failed to delete estimate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
