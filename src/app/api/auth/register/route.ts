import { NextRequest, NextResponse } from "next/server";
import { hashSync } from "bcryptjs";
import { prisma } from "@/lib/prisma";

const ALLOWED_DOMAIN = "ubinsights.com";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    // Only allow @ubinsights.com emails
    const emailDomain = email.split("@")[1]?.toLowerCase();
    if (emailDomain !== ALLOWED_DOMAIN) {
      return NextResponse.json(
        { error: "Only @ubinsights.com email addresses are allowed to register" },
        { status: 403 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash: hashSync(password, 10),
        role: "MANAGER",
      },
    });

    return NextResponse.json(
      { message: "Account created successfully", userId: user.id },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
