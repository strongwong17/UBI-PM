// src/app/api/projects/[id]/generate-invoice/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";

/**
 * @deprecated Use POST /api/projects/[id]/invoices with mode: "SLICE" instead.
 * This wrapper exists for one release cycle to avoid breaking older callers.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(["ADMIN", "MANAGER"]);
  if (isAuthError(authResult)) return authResult;

  console.warn(
    "[deprecated] POST /api/projects/[id]/generate-invoice — use POST /api/projects/[id]/invoices with mode 'SLICE' instead",
  );

  const { id } = await params;
  const body = await request.json();
  const { estimateId } = body as { estimateId?: string };

  if (!estimateId) return NextResponse.json({ error: "estimateId required" }, { status: 400 });

  const estimate = await prisma.estimate.findUnique({
    where: { id: estimateId },
    include: {
      phases: {
        include: { lineItems: { orderBy: { sortOrder: "asc" } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!estimate || estimate.projectId !== id) {
    return NextResponse.json({ error: "Estimate not found for this project" }, { status: 404 });
  }

  const lines = estimate.phases.flatMap((p) =>
    p.lineItems.map((l) => ({ estimateLineItemId: l.id, quantity: l.quantity }))
  );

  // Forward to the new endpoint
  const url = new URL(request.url);
  url.pathname = `/api/projects/${id}/invoices`;
  const forward = new Request(url.toString(), {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({ estimateId, mode: "SLICE", lines }),
  });
  // Call the handler directly to avoid an extra HTTP hop
  const { POST: createInvoice } = await import("../invoices/route");
  return createInvoice(forward as NextRequest, { params: Promise.resolve({ id }) });
}
