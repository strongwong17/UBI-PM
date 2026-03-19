import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if (isAuthError(authResult)) return authResult;

    const { id } = await params;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        contacts: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
        projects: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            projectNumber: true,
            title: true,
            status: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            contacts: true,
            projects: true,
          },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error("Error fetching client:", error);
    return NextResponse.json({ error: "Failed to fetch client" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(["ADMIN", "MANAGER"]);
    if (isAuthError(authResult)) return authResult;
    const { userId } = authResult;

    const { id } = await params;
    const body = await request.json();
    const {
      company,
      shortName,
      industry,
      email,
      phone,
      wechatId,
      notes,
      billingName,
      billingAddress,
      billingEmail,
      billingPhone,
      taxId,
    } = body;

    if (!company || typeof company !== "string" || company.trim().length === 0) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    }

    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const client = await prisma.client.update({
      where: { id },
      data: {
        company: company.trim(),
        shortName: shortName?.trim() || null,
        industry: industry?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        wechatId: wechatId?.trim() || null,
        notes: notes?.trim() || null,
        billingName: billingName?.trim() || null,
        billingAddress: billingAddress?.trim() || null,
        billingEmail: billingEmail?.trim() || null,
        billingPhone: billingPhone?.trim() || null,
        taxId: taxId?.trim() || null,
      },
      include: {
        contacts: true,
        _count: { select: { contacts: true, projects: true } },
      },
    });

    await logActivity({
      action: "UPDATE",
      entityType: "CLIENT",
      entityId: id,
      entityLabel: client.company,
      description: `Updated client ${client.company}`,
      userId,
    });

    return NextResponse.json(client);
  } catch (error) {
    console.error("Error updating client:", error);
    return NextResponse.json({ error: "Failed to update client" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(["ADMIN", "MANAGER"]);
    if (isAuthError(authResult)) return authResult;
    const { userId } = authResult;

    const { id } = await params;

    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    await prisma.client.delete({ where: { id } });

    await logActivity({
      action: "DELETE",
      entityType: "CLIENT",
      entityId: id,
      entityLabel: existing.company,
      description: `Deleted client ${existing.company}`,
      userId,
    });

    return NextResponse.json({ message: "Client deleted successfully" });
  } catch (error) {
    console.error("Error deleting client:", error);
    return NextResponse.json({ error: "Failed to delete client" }, { status: 500 });
  }
}
