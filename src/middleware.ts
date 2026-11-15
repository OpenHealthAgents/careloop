import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionTokenEdge } from "@/lib/auth/edge-token";

const PUBLIC_PATHS = new Set([
  "/",
  "/how-it-works",
  "/for-you",
  "/for-families",
  "/our-approach",
  "/why-careloop",
  "/faq",
  "/about",
  "/contact",
  "/join",
  "/privacy",
  "/terms",
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/health",
  "/api/waitlist",
  "/design-system",
]);

function withSecurityHeaders(response: NextResponse, pathname: string): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "no-store, max-age=0");
    response.headers.set("Pragma", "no-cache");
  }
  return response;
}

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/cases",
  "/appointments",
  "/approvals",
  "/interventions",
  "/worklist",
  "/referrals",
  "/health-equity",
  "/analytics",
  "/audit-log",
  "/settings",
  "/members",
  "/member-portal",
  "/pilot",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/resources") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/apple-icon")
  ) {
    return withSecurityHeaders(NextResponse.next(), pathname);
  }

  const isProtectedPath =
    PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/")) ||
    (pathname.startsWith("/api/") && !PUBLIC_PATHS.has(pathname));

  if (!isProtectedPath) {
    // Non-existent or other public routes fall through to Next.js 404 handler
    return withSecurityHeaders(NextResponse.next(), pathname);
  }

  const rawSecret = process.env.AUTH_SECRET;
  const isProd = process.env.NODE_ENV === "production";
  if (
    isProd &&
    (!rawSecret ||
      rawSecret === "careloop-dev-only-secret-change-in-production-2026" ||
      rawSecret.length < 32)
  ) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          error: {
            code: "CONFIGURATION_ERROR",
            message: "Authentication secret is not configured for production.",
          },
        },
        { status: 503 }
      ),
      pathname
    );
  }
  const secret = rawSecret || "careloop-dev-only-secret-change-in-production-2026";
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const verified = await verifySessionTokenEdge(token, secret);

  if (!verified) {
    if (pathname.startsWith("/api/")) {
      return withSecurityHeaders(
        NextResponse.json(
          {
            error: {
              code: "AUTHENTICATION_ERROR",
              message: "Authentication required. Please sign in.",
            },
          },
          { status: 401 }
        ),
        pathname
      );
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return withSecurityHeaders(NextResponse.redirect(loginUrl), pathname);
  }

  return withSecurityHeaders(NextResponse.next(), pathname);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
