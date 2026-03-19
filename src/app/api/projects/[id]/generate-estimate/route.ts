import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { generateEstimateNumber } from "@/lib/generate-number";

const MODULE_TO_PHASE: Record<
  string,
  { phaseName: string; description: string; unit: string; sortOrder: number }
> = {
  FULL_SERVICE: {
    phaseName: "Full Service",
    description: "Full Service Research",
    unit: "project",
    sortOrder: 0,
  },
  RECRUITMENT: {
    phaseName: "Recruitment",
    description: "Participant Recruitment",
    unit: "participants",
    sortOrder: 1,
  },
  RECRUITMENT_MODERATION: {
    phaseName: "Fieldwork",
    description: "Recruitment + Moderation",
    unit: "sessions",
    sortOrder: 2,
  },
  MODERATION: {
    phaseName: "Fieldwork",
    description: "Moderation Sessions",
    unit: "sessions",
    sortOrder: 3,
  },
  INCENTIVES: {
    phaseName: "Incentives",
    description: "Participant Incentives",
    unit: "participants",
    sortOrder: 4,
  },
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(["ADMIN", "MANAGER"]);
    if (isAuthError(authResult)) return authResult;
    const { userId } = authResult;

    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: { select: { company: true, shortName: true } },
        inquiry: { include: { serviceModules: { orderBy: { sortOrder: "asc" } } } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.inquiry || project.inquiry.serviceModules.length === 0) {
      return NextResponse.json(
        { error: "Project has no inquiry or service modules to generate from" },
        { status: 400 }
      );
    }

    const modules = project.inquiry.serviceModules;

    // Group by phase name
    const phaseMap = new Map<
      string,
      {
        phaseName: string;
        sortOrder: number;
        items: {
          moduleType: string;
          description: string;
          unit: string;
          quantity: number;
          unitPrice: number;
          notes: string | null;
        }[];
      }
    >();

    for (const mod of modules) {
      const mapping = MODULE_TO_PHASE[mod.moduleType];
      if (!mapping) continue;

      const { phaseName, sortOrder } = mapping;
      if (!phaseMap.has(phaseName)) {
        phaseMap.set(phaseName, { phaseName, sortOrder, items: [] });
      }

      // RECRUITMENT defaults quantity to participantCount if not set
      let qty = mod.quantity ?? 1;
      if (mod.moduleType === "RECRUITMENT" && !mod.quantity && project.inquiry!.participantCount) {
        qty = project.inquiry!.participantCount;
      }

      phaseMap.get(phaseName)!.items.push({
        moduleType: mod.moduleType,
        description: mapping.description,
        unit: mod.unit || mapping.unit,
        quantity: qty,
        unitPrice: mod.unitPrice ?? 0,
        notes: mod.notes || null,
      });
    }

    // Determine next version
    const latestVersion = await prisma.estimate.findFirst({
      where: { projectId: id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (latestVersion?.version ?? 0) + 1;

    const phases = Array.from(phaseMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);

    // Calculate subtotal from all service-module phases (for management fee)
    let serviceSubtotal = 0;
    for (const phase of phases) {
      for (const item of phase.items) {
        serviceSubtotal += item.quantity * item.unitPrice;
      }
    }

    const estimateNumber = await generateEstimateNumber(project.client.shortName || project.client.company, project.title);

    const estimate = await prisma.estimate.create({
      data: {
        estimateNumber,
        title: project.title,
        version: nextVersion,
        status: "DRAFT",
        projectId: id,
        currency: project.inquiry!.currency || "USD",
        createdById: userId,
        phases: {
          create: [
            ...phases.map((phase, phaseIndex) => ({
              name: phase.phaseName,
              sortOrder: phaseIndex,
              lineItems: {
                create: phase.items.map((item, itemIndex) => ({
                  description: item.description,
                  unit: item.unit,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  sortOrder: itemIndex,
                  notes: item.notes,
                  serviceModuleType: item.moduleType,
                })),
              },
            })),
            // Administration phase: Project Setup + Management Fee (15% of subtotal)
            {
              name: "Administration",
              sortOrder: phases.length,
              lineItems: {
                create: [
                  {
                    description: "Project Setup",
                    unit: "units",
                    quantity: 1,
                    unitPrice: 500,
                    sortOrder: 0,
                  },
                  {
                    description: "Management Fee",
                    unit: "15% of estimate subtotal",
                    quantity: 1,
                    unitPrice: Math.round((serviceSubtotal + 500) * 0.15 * 100) / 100,
                    sortOrder: 1,
                    percentageBasis: "SUBTOTAL",
                    percentageRate: 15,
                  },
                ],
              },
            },
          ],
        },
      },
      include: {
        project: { select: { id: true, title: true } },
        phases: {
          include: { lineItems: { orderBy: { sortOrder: "asc" } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    // Auto-advance project status to ESTIMATE_SENT if still at INQUIRY_RECEIVED
    if (project.status === "INQUIRY_RECEIVED") {
      await prisma.project.update({
        where: { id },
        data: { status: "ESTIMATE_SENT" },
      });
    }

    await logActivity({
      action: "GENERATE",
      entityType: "ESTIMATE",
      entityId: estimate.id,
      entityLabel: estimate.estimateNumber,
      description: `Generated estimate from brief`,
      userId,
      projectId: id,
    });

    return NextResponse.json(estimate, { status: 201 });
  } catch (error) {
    console.error("Failed to generate estimate:", error);
    return NextResponse.json({ error: "Failed to generate estimate" }, { status: 500 });
  }
}
