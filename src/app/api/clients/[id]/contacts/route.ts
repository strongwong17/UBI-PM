import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, email, phone, title, isPrimary } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Contact name is required" },
        { status: 400 }
      );
    }

    // If this contact is set as primary, unset other primary contacts
    if (isPrimary) {
      await prisma.clientContact.updateMany({
        where: { clientId: id, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const contact = await prisma.clientContact.create({
      data: {
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        title: title?.trim() || null,
        isPrimary: isPrimary || false,
        clientId: id,
      },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error("Error creating contact:", error);
    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 }
    );
  }
}
