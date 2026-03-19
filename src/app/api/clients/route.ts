import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isAuthError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    const clients = await prisma.client.findMany({
      where: search
        ? {
            OR: [
              { company: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : undefined,
      include: {
        _count: {
          select: {
            contacts: true,
            projects: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(clients);
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(["ADMIN", "MANAGER"]);
    if (isAuthError(authResult)) return authResult;
    const { userId } = authResult;

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
      contacts,
    } = body;

    if (!company || typeof company !== "string" || company.trim().length === 0) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    }

    const client = await prisma.client.create({
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
        contacts:
          contacts && contacts.length > 0
            ? {
                create: contacts.map(
                  (c: {
                    name: string;
                    email?: string;
                    phone?: string;
                    title?: string;
                    isPrimary?: boolean;
                  }) => ({
                    name: c.name.trim(),
                    email: c.email?.trim() || null,
                    phone: c.phone?.trim() || null,
                    title: c.title?.trim() || null,
                    isPrimary: c.isPrimary || false,
                  })
                ),
              }
            : undefined,
      },
      include: {
        contacts: true,
        _count: { select: { contacts: true, projects: true } },
      },
    });

    await logActivity({
      action: "CREATE",
      entityType: "CLIENT",
      entityId: client.id,
      entityLabel: client.company,
      description: `Created client ${client.company}`,
      userId,
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
  }
}
