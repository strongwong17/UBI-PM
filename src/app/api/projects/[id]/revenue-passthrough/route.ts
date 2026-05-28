import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(["ADMIN", "MANAGER"]);
  if (isAuthError(authResult)) return authResult;
  const { id } = await params;
  const { estimateLineItemId, isPassthrough } = await request.json();

  if (typeof estimateLineItemId !== "string" || typeof isPassthrough !== "boolean") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Verify the line belongs to an estimate on this project.
  const line = await prisma.estimateLineItem.findUnique({
    where: { id: estimateLineItemId },
    select: { id: true, phase: { select: { estimate: { select: { projectId: true } } } } },
  });
  if (!line || line.phase.estimate.projectId !== id) {
    return NextResponse.json({ error: "Line not found for this project" }, { status: 404 });
  }

  await prisma.estimateLineItem.update({
    where: { id: estimateLineItemId },
    data: { isPassthrough },
  });
  return NextResponse.json({ ok: true });
}
