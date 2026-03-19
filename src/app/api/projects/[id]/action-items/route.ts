import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if (isAuthError(authResult)) return authResult;
    const { id } = await params;

    const items = await prisma.actionItem.findMany({
      where: { projectId: id },
      orderBy: [{ completed: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch action items:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(["ADMIN", "MANAGER"]);
    if (isAuthError(authResult)) return authResult;
    const { id } = await params;
    const body = await request.json();
    const { title, tag, category, clientSignalId } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title required" }, { status: 400 });
    }

    const item = await prisma.actionItem.create({
      data: {
        title: title.trim(),
        tag: tag?.trim() || null,
        category: category || "TODO",
        projectId: id,
        clientSignalId: clientSignalId || null,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Failed to create action item:", error);
    const message = error instanceof Error ? error.message : "Failed to create";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(["ADMIN", "MANAGER"]);
    if (isAuthError(authResult)) return authResult;
    const body = await request.json();
    const { itemId, completed, title, deleted } = body;

    if (!itemId) {
      return NextResponse.json({ error: "itemId required" }, { status: 400 });
    }

    // Delete
    if (deleted) {
      await prisma.actionItem.delete({ where: { id: itemId } });
      return NextResponse.json({ success: true });
    }

    const data: Record<string, unknown> = {};
    if (completed !== undefined) {
      data.completed = completed;
      data.completedAt = completed ? new Date() : null;
    }
    if (title !== undefined) data.title = title;

    const item = await prisma.actionItem.update({
      where: { id: itemId },
      data,
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to update action item:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
