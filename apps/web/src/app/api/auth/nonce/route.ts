import { NextRequest, NextResponse } from "next/server";
import { generateNonce, buildSignMessage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/nonce
 * Returns a nonce and the message to sign. Nonce expires in 5 minutes.
 * Rate limited: 10 nonces/min per IP to prevent DB flooding.
 */
export async function GET(req: NextRequest) {
  try {
    // Rate limit: 30 nonces/min per IP.
    // Fail OPEN: if DB is down, the authNonce.create below will also fail
    // with a proper 500, so there's no risk of unbounded nonce creation.
    const clientIp = getClientIp(req);
    const limit = await checkRateLimit(`nonce:ip:${clientIp}`, 30, 60_000, "open");
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests", code: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(limit.resetMs / 1000)) } }
      );
    }

    const nonce = generateNonce();
    const message = buildSignMessage(nonce);

    // Store nonce with 5-minute expiry
    await prisma.authNonce.create({
      data: {
        nonce,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    return NextResponse.json({ nonce, message });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Nonce error:", message);
    // Surface DB connectivity issues clearly
    const isDbError = message.includes("connect") || message.includes("ECONNREFUSED") || message.includes("prisma");
    return NextResponse.json(
      { error: isDbError ? "Database unavailable" : "Failed to generate nonce" },
      { status: 503 }
    );
  }
}
