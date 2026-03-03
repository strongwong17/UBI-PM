import { prisma } from "@/lib/prisma";

interface LogActivityParams {
  action: string;       // CREATE, UPDATE, DELETE, STATUS_CHANGE, APPROVE, DUPLICATE, GENERATE, RESTORE
  entityType: string;   // PROJECT, ESTIMATE, INVOICE, CLIENT, INQUIRY, ATTACHMENT
  entityId: string;
  entityLabel?: string; // e.g. "PRJ-2026-001"
  description: string;
  metadata?: Record<string, unknown>;
  userId: string;
  projectId?: string | null;
}

export async function logActivity({
  action,
  entityType,
  entityId,
  entityLabel,
  description,
  metadata,
  userId,
  projectId,
}: LogActivityParams) {
  try {
    await prisma.activityLog.create({
      data: {
        action,
        entityType,
        entityId,
        entityLabel: entityLabel ?? null,
        description,
        metadata: metadata ? JSON.stringify(metadata) : null,
        userId,
        projectId: projectId ?? null,
      },
    });
  } catch (error) {
    // Log but don't throw — activity logging should never block mutations
    console.error("Failed to log activity:", error);
  }
}
