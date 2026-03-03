import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
          status: nowApproved ? "APPROVED" : "DRAFT",
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
        // Set project status to APPROVED
        await tx.project.update({
          where: { id: estimate.projectId },
          data: { status: "APPROVED" },
        });
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
      userId: (session.user as any).id,
      projectId: estimate.projectId,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to approve estimate:", error);
    return NextResponse.json({ error: "Failed to approve estimate" }, { status: 500 });
  }
}
