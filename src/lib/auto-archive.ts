import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

/**
 * Auto-archive gate: flips a project from DELIVERED → CLOSED when every condition is met.
 * Called from invoice PATCH (on PAID), completion PATCH (after dual sign-off),
 * and feedback PUT (after either side submits).
 *
 * Conditions, all required:
 *   1. project.status === "DELIVERED" (dual sign-off already happened)
 *   2. at least one non-deleted invoice exists, and every non-deleted invoice is PAID
 *   3. ProjectFeedback row exists with both internalSubmittedAt and clientSubmittedAt set
 *
 * Idempotent — safe to call multiple times. Logs a STATUS_CHANGE activity when it fires.
 */
export async function checkAndAutoArchive(projectId: string, userId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, status: true, projectNumber: true },
  });
  if (!project || project.status !== "DELIVERED") return false;

  const invoices = await prisma.invoice.findMany({
    where: { projectId, deletedAt: null },
    select: { status: true },
  });
  if (invoices.length === 0) return false;
  const allPaid = invoices.every((i) => i.status === "PAID");
  if (!allPaid) return false;

  const feedback = await prisma.projectFeedback.findUnique({
    where: { projectId },
    select: { internalSubmittedAt: true, clientSubmittedAt: true },
  });
  if (!feedback?.internalSubmittedAt || !feedback?.clientSubmittedAt) return false;

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "CLOSED", endDate: new Date() },
  });

  await logActivity({
    action: "STATUS_CHANGE",
    entityType: "PROJECT",
    entityId: projectId,
    entityLabel: project.projectNumber,
    description: "Auto-archived project (paid + dual feedback collected)",
    metadata: { from: "DELIVERED", to: "CLOSED", trigger: "auto-archive" },
    userId,
    projectId,
  });

  return true;
}
