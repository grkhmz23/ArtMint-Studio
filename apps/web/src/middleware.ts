import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js middleware for security headers and CORS.
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const origin = req.headers.get("origin") ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // CORS: only allow same-origin requests to API routes
  if (req.nextUrl.pathname.startsWith("/api/")) {
    // Allow requests with no origin (same-origin, server-to-server)
    if (origin && origin !== appUrl) {
      return NextResponse.json(
        { error: "CORS: origin not allowed" },
        { status: 403 }
      );
    }
  }

  // Security headers (all routes including uploads)
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-DNS-Prefetch-Control", "off");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // HSTS — enforce HTTPS in production
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  // CSP for pages — allow inline styles (needed for React inline styles),
  // wallet adapter scripts, and self for everything else.
  // Note: the render API sets its own restrictive CSP on SVG responses.
  if (!req.nextUrl.pathname.startsWith("/api/")) {
    res.headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: http://localhost:* https:",
        "connect-src 'self' https://api.devnet.solana.com https://api.mainnet-beta.solana.com https://*.helius-rpc.com wss:",
        "frame-src 'self' blob:",
        "frame-ancestors 'none'",
      ].join("; ")
    );
  }

  return res;
}

export const config = {
  // Run on all routes — including uploads (for security headers)
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
