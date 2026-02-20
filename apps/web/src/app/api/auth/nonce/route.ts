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
    // Rate limit: 10 nonces/min per IP
    const clientIp = getClientIp(req);
    const limit = await checkRateLimit(`nonce:ip:${clientIp}`, 30, 60_000);
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
    console.error("Nonce error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to generate nonce" }, { status: 500 });
  }
}
