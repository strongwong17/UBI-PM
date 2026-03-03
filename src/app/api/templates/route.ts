import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const templates = await prisma.estimateTemplate.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            phases: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, pricingModel, phases } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 }
      );
    }

    const template = await prisma.estimateTemplate.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        pricingModel: pricingModel || "MIXED",
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
                            create: phase.lineItems.map(
                              (item, itemIndex) => ({
                                description: item.description,
                                unit: item.unit || "hours",
                                defaultQuantity: item.defaultQuantity ?? 1,
                                defaultPrice: item.defaultPrice,
                                sortOrder: item.sortOrder ?? itemIndex,
                              })
                            ),
                          }
                        : undefined,
                  })
                ),
              }
            : undefined,
      },
      include: {
        phases: {
          include: {
            lineItems: {
              orderBy: { sortOrder: "asc" },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    await logActivity({
      action: "CREATE",
      entityType: "TEMPLATE",
      entityId: template.id,
      entityLabel: template.name,
      description: `Created template ${template.name}`,
      userId: (session.user as any).id,
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
