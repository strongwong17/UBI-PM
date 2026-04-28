import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { generateEstimateNumber } from "@/lib/generate-number";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isAuthError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { deletedAt: null };
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    const estimates = await prisma.estimate.findMany({
      where,
      include: {
        project: {
          include: { client: true },
        },
        createdBy: { select: { id: true, name: true, email: true } },
        phases: {
          include: { lineItems: true },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(estimates);
  } catch (error) {
    console.error("Error fetching estimates:", error);
    return NextResponse.json({ error: "Failed to fetch estimates" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(["ADMIN", "MANAGER"]);
    if (isAuthError(authResult)) return authResult;
    const { userId } = authResult;

    const body = await request.json();
    const {
      title,
      label,
      projectName,
      address,
      projectId,
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

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { client: { select: { company: true, shortName: true } } },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const versionAgg = await prisma.estimate.aggregate({
      where: { projectId },
      _max: { version: true },
    });
    const nextVersion = (versionAgg._max.version ?? 0) + 1;

    const estimateNumber = await generateEstimateNumber(project.client.shortName || project.client.company, project.title);

    const estimate = await prisma.estimate.create({
      data: {
        estimateNumber,
        title: title.trim(),
        label: label?.trim() || null,
        projectName: projectName?.trim() || null,
        address: address?.trim() || null,
        version: nextVersion,
        projectId,
        pricingModel: pricingModel || "MIXED",
        currency: currency || "USD",
        taxRate: taxRate ?? 0,
        discount: discount ?? 0,
        notes: notes?.trim() || null,
        clientNotes: clientNotes?.trim() || null,
        validUntil: validUntil ? new Date(validUntil) : null,
        createdById: userId,
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

    await logActivity({
      action: "CREATE",
      entityType: "ESTIMATE",
      entityId: estimate.id,
      entityLabel: estimate.estimateNumber,
      description: `Created estimate ${estimate.estimateNumber}`,
      userId,
      projectId,
    });

    const proj = await prisma.project.findUnique({ where: { id: estimate.projectId }, select: { status: true } });
    if (proj && (proj.status === "NEW" || proj.status === "BRIEFED" || proj.status === "INQUIRY_RECEIVED")) {
      await prisma.project.update({ where: { id: estimate.projectId }, data: { status: "ESTIMATING" } });
    }

    return NextResponse.json(estimate, { status: 201 });
  } catch (error) {
    console.error("Error creating estimate:", error);
    return NextResponse.json({ error: "Failed to create estimate" }, { status: 500 });
  }
}
