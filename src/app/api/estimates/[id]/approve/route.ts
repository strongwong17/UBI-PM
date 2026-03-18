import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(["ADMIN", "MANAGER"]);
    if (isAuthError(authResult)) return authResult;
    const { userId } = authResult;

    const { id } = await params;

    const estimate = await prisma.estimate.findUnique({ where: { id } });
    if (!estimate) {
      return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    }

    const nowApproved = !estimate.isApproved;

    const updated = await prisma.$transaction(async (tx) => {
      const est = await tx.estimate.update({
        where: { id },
        data: {
          isApproved: nowApproved,
          status: nowApproved ? "SENT" : "DRAFT",
        },
        include: {
          project: { select: { id: true, title: true } },
          phases: {
            include: { lineItems: { orderBy: { sortOrder: "asc" } } },
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      if (nowApproved) {
        // Set project status to IN_PROGRESS + start date (only if not already past that stage)
        const project = await tx.project.findUnique({
          where: { id: estimate.projectId },
          select: { startDate: true, status: true },
        });
        const noForwardJump = ["COMPLETED", "INVOICED", "PAID", "CLOSED"];
        if (project && !noForwardJump.includes(project.status)) {
          await tx.project.update({
            where: { id: estimate.projectId },
            data: {
              status: "IN_PROGRESS",
              startDate: project.startDate ?? new Date(),
            },
          });
        }
      } else {
        // Check if any other approved estimates remain
        const otherApproved = await tx.estimate.findFirst({
          where: {
            projectId: estimate.projectId,
            isApproved: true,
            deletedAt: null,
            id: { not: id },
          },
        });
        if (!otherApproved) {
          await tx.project.update({
            where: { id: estimate.projectId },
            data: { status: "ESTIMATE_SENT" },
          });
        }
      }

      return est;
    });

    await logActivity({
      action: nowApproved ? "APPROVE" : "STATUS_CHANGE",
      entityType: "ESTIMATE",
      entityId: id,
      entityLabel: estimate.estimateNumber,
      description: nowApproved
        ? `Approved estimate ${estimate.estimateNumber}`
        : `Unapproved estimate ${estimate.estimateNumber}`,
      userId,
      projectId: estimate.projectId,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to approve estimate:", error);
    return NextResponse.json({ error: "Failed to approve estimate" }, { status: 500 });
  }
}
