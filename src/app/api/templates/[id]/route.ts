import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Failed to fetch template:", error);
    return NextResponse.json({ error: "Failed to fetch template" }, { status: 500 });
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

    const existing = await prisma.estimateTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, pricingModel, isActive, phases } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    }

    // Delete existing phases (cascade deletes line items)
    await prisma.templatePhase.deleteMany({ where: { templateId: id } });

    const template = await prisma.estimateTemplate.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        pricingModel: pricingModel || "MIXED",
        isActive: isActive ?? true,
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
                        defaultQuantity?: number;
                        defaultPrice: number;
                        sortOrder?: number;
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
                              defaultQuantity: item.defaultQuantity ?? 1,
                              defaultPrice: item.defaultPrice,
                              sortOrder: item.sortOrder ?? itemIndex,
                            })),
                          }
                        : undefined,
                  })
                ),
              }
            : undefined,
      },
      include: {
        phases: {
          include: { lineItems: { orderBy: { sortOrder: "asc" } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    await logActivity({
      action: "UPDATE",
      entityType: "TEMPLATE",
      entityId: id,
      entityLabel: template.name,
      description: `Updated template ${template.name}`,
      userId: (session.user as any).id,
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("Failed to update template:", error);
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.estimateTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await prisma.estimateTemplate.delete({ where: { id } });

    await logActivity({
      action: "DELETE",
      entityType: "TEMPLATE",
      entityId: id,
      entityLabel: existing.name,
      description: `Deleted template ${existing.name}`,
      userId: (session.user as any).id,
    });

    return NextResponse.json({ message: "Template deleted" });
  } catch (error) {
    console.error("Failed to delete template:", error);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
