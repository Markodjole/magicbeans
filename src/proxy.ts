import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const ROLE_PREFIXES: Record<string, "INVESTOR" | "DEVELOPER" | "ADMIN"> = {
  "/investor": "INVESTOR",
  "/developer": "DEVELOPER",
  "/admin": "ADMIN",
};

/**
 * Optimistic route-level check only (per Next.js guidance: proxy should
 * not be the sole authorization mechanism). Every server action and data
 * loader behind these routes re-verifies via requireRole() in
 * src/lib/authz.ts — this just avoids flashing a protected page before
 * redirecting an obviously-unauthenticated or wrong-role visitor.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const matchedPrefix = Object.keys(ROLE_PREFIXES).find((prefix) => pathname.startsWith(prefix));
  if (!matchedPrefix) return NextResponse.next();

  const requiredRole = ROLE_PREFIXES[matchedPrefix];
  const user = req.auth?.user;

  if (!user) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user.role !== requiredRole && user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/investor/:path*", "/developer/:path*", "/admin/:path*"],
};
