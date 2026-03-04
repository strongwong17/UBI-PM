import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    cookieName:
      req.nextUrl.protocol === "https:"
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
  });
  const isLoggedIn = !!token;
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isRegisterPage = req.nextUrl.pathname === "/register";
  const isSharePage = req.nextUrl.pathname.startsWith("/share/");
  const isApiAuth = req.nextUrl.pathname.startsWith("/api/auth");
  const isApiShare = req.nextUrl.pathname.startsWith("/api/share");

  // Allow public routes
  if (isSharePage || isApiAuth || isApiShare) {
    return NextResponse.next();
  }

  // Redirect to login if not authenticated
  if (!isLoggedIn && !isLoginPage && !isRegisterPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // Redirect to dashboard if already logged in
  if (isLoggedIn && (isLoginPage || isRegisterPage)) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
