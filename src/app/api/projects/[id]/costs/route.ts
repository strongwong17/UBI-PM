import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(["ADMIN", "MANAGER"]);
  if (isAuthError(authResult)) return authResult;
  const { id } = await params;
  const costLineItems = await prisma.costLineItem.findMany({
    where: { projectId: id },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(costLineItems);
}

interface IncomingCostLine {
  description?: string;
  costType?: string;
  hours?: number | null;
  rate?: number | null;
  amount?: number | null;
  category?: string | null;
  notes?: string | null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(["ADMIN", "MANAGER"]);
  if (isAuthError(authResult)) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, projectNumber: true } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = await request.json();
  const lines: IncomingCostLine[] = Array.isArray(body.lineItems) ? body.lineItems : [];

  await prisma.$transaction(async (tx) => {
    await tx.costLineItem.deleteMany({ where: { projectId: id } });
    if (lines.length > 0) {
      await tx.costLineItem.createMany({
        data: lines.map((l, idx) => ({
          projectId: id,
          description: l.description ?? "",
          costType: l.costType === "HOURS" ? "HOURS" : "FLAT",
          hours: l.hours ?? null,
          rate: l.rate ?? null,
          amount: l.amount ?? null,
          category: l.category ?? null,
          notes: l.notes ?? null,
          sortOrder: idx,
        })),
      });
    }
  });

  await logActivity({
    action: "UPDATE",
    entityType: "PROJECT",
    entityId: id,
    entityLabel: project.projectNumber,
    description: `Updated cost ledger (${lines.length} lines)`,
    userId,
    projectId: id,
  });

  const costLineItems = await prisma.costLineItem.findMany({
    where: { projectId: id },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(costLineItems);
}
