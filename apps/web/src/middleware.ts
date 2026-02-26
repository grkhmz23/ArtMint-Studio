import { NextRequest, NextResponse } from "next/server";

const SANDBOXED_ARTIFACT_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "connect-src 'none'",
  "font-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
  "sandbox allow-scripts allow-downloads",
].join("; ");

function getUrlOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isUploadedHtmlArtifact(pathname: string): boolean {
  return pathname.startsWith("/uploads/") && pathname.toLowerCase().endsWith(".html");
}

/**
 * Next.js middleware for security headers and CORS.
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const origin = req.headers.get("origin") ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const pathname = req.nextUrl.pathname;

  // CORS: only allow same-origin requests to API routes
  if (pathname.startsWith("/api/")) {
    // Allow requests with no origin (same-origin, server-to-server)
    if (origin) {
      // Compare host portion to handle http/https and trailing slash differences
      const allowedHost = new URL(appUrl).host;
      const requestHost = new URL(req.url).host;
      const originHost = (() => {
        try { return new URL(origin).host; } catch { return ""; }
      })();
      // Allow if origin matches the app URL or the request's own host
      if (originHost !== allowedHost && originHost !== requestHost) {
        return NextResponse.json(
          { error: "CORS: origin not allowed" },
          { status: 403 }
        );
      }
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

  // Untrusted HTML artifacts (local storage mode) need a sandboxed CSP to prevent
  // same-origin script execution when opened directly in a tab.
  if (isUploadedHtmlArtifact(pathname)) {
    res.headers.set("X-Frame-Options", "SAMEORIGIN");
    res.headers.set("Referrer-Policy", "no-referrer");
    res.headers.set("Content-Security-Policy", SANDBOXED_ARTIFACT_CSP);
    return res;
  }

  // CSP for pages — allow inline styles (needed for React inline styles),
  // wallet adapter scripts, and self for everything else.
  // Note: the render API sets its own restrictive CSP on SVG responses.
  if (!pathname.startsWith("/api/")) {
    const connectSrc = new Set([
      "'self'",
      "https://api.devnet.solana.com",
      "https://api.mainnet-beta.solana.com",
      "https://*.helius-rpc.com",
      "https://cdn.jsdelivr.net",
      "wss:",
    ]);
    const publicRpcOrigin = getUrlOrigin(process.env.NEXT_PUBLIC_SOLANA_RPC_URL);
    if (publicRpcOrigin) connectSrc.add(publicRpcOrigin);

    res.headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
        "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
        "img-src 'self' data: blob: http://localhost:* https:",
        `connect-src ${Array.from(connectSrc).join(" ")}`,
        "worker-src 'self' blob:",
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
