import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED = ["/manager", "/worker", "/settings", "/dashboard", "/change-password"];
const AUTH_ONLY = [
  "/login",
  "/register",
  "/reset-password",
  "/verification-pending",
];

function decodeToken(token: string): { exp?: number; role?: string } {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8"),
    );
  } catch {
    return {};
  }
}

function isExpired(token: string): boolean {
  const { exp } = decodeToken(token);
  return typeof exp !== "number" || exp < Math.floor(Date.now() / 1000);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("access_token")?.value;
  const validToken = token && !isExpired(token);

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isAuthOnly = AUTH_ONLY.some((p) => pathname.startsWith(p));

  if (isProtected && !validToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based cross-route protection: a link (worker) must not reach /manager and vice versa
  if (isProtected && validToken && token) {
    const { role } = decodeToken(token);
    if (role === "link" && pathname.startsWith("/manager")) {
      return NextResponse.redirect(new URL("/worker", request.url));
    }
    if (role === "manager" && pathname.startsWith("/worker")) {
      return NextResponse.redirect(new URL("/manager", request.url));
    }
  }

  if (isAuthOnly && validToken && token) {
    const { role } = decodeToken(token);
    const home = role === "link" ? "/worker" : "/manager";
    return NextResponse.redirect(new URL(home, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico).*)"],
};
