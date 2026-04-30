import { prisma } from "@/lib/prisma";

const THIRTY_DAYS_MS = 30 * 86_400_000;

/**
 * Flip ESTIMATING projects to EXPIRED when every non-deleted SENT estimate
 * is older than 30 days and no estimate is approved. Idempotent.
 */
export async function expireStaleEstimates(): Promise<number> {
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);

  const candidates = await prisma.project.findMany({
    where: {
      status: "ESTIMATING",
      estimates: {
        some: { deletedAt: null, status: "SENT" },
        none: { deletedAt: null, isApproved: true },
      },
    },
    select: {
      id: true,
      estimates: {
        where: { deletedAt: null, status: "SENT" },
        select: { updatedAt: true },
      },
    },
  });

  const toExpire = candidates
    .filter(
      (p) =>
        p.estimates.length > 0 &&
        p.estimates.every((e) => e.updatedAt < cutoff),
    )
    .map((p) => p.id);

  if (toExpire.length === 0) return 0;

  await prisma.project.updateMany({
    where: { id: { in: toExpire } },
    data: { status: "EXPIRED" },
  });
  return toExpire.length;
}
