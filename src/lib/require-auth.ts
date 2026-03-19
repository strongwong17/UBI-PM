import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Role = "ADMIN" | "MANAGER" | "VIEWER";

interface AuthResult {
  userId: string;
  role: Role;
  name: string;
}

/**
 * Verify the user is authenticated and optionally check role.
 * Returns the user info or a NextResponse error.
 *
 * Usage:
 *   const authResult = await requireAuth();
 *   if (authResult instanceof NextResponse) return authResult;
 *   const { userId, role } = authResult;
 */
export async function requireAuth(
  allowedRoles?: Role[]
): Promise<AuthResult | NextResponse> {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id as string;
  const role = ((session.user as any).role || "VIEWER") as Role;
  const name = session.user.name || "User";

  // Verify user still exists in DB (catches stale JWTs after DB restore/reset)
  const userExists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!userExists) {
    const response = NextResponse.json(
      { error: "Session expired. Please log in again." },
      { status: 401 }
    );
    // Clear session cookies so middleware redirects to /login on next navigation
    response.cookies.set("authjs.session-token", "", { maxAge: 0, path: "/" });
    response.cookies.set("__Secure-authjs.session-token", "", { maxAge: 0, path: "/", secure: true });
    return response;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { userId, role, name };
}

/**
 * Quick check: is the result an error response?
 */
export function isAuthError(
  result: AuthResult | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
