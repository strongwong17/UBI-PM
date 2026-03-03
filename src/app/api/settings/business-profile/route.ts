import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await prisma.businessProfile.findUnique({ where: { id: "default" } });

    if (!profile) {
      return NextResponse.json({
        id: "default",
        name: "UBInsights LLC",
        address: null,
        email: null,
        phone: null,
        tagline: null,
      });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Error fetching business profile:", error);
    return NextResponse.json({ error: "Failed to fetch business profile" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, address, email, phone, tagline } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Business name is required" }, { status: 400 });
    }

    const profile = await prisma.businessProfile.upsert({
      where: { id: "default" },
      update: {
        name: name.trim(),
        address: address?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        tagline: tagline?.trim() || null,
      },
      create: {
        id: "default",
        name: name.trim(),
        address: address?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        tagline: tagline?.trim() || null,
      },
    });

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Error updating business profile:", error);
    return NextResponse.json({ error: "Failed to update business profile" }, { status: 500 });
  }
}
