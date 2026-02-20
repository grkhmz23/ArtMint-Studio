import { NextResponse } from "next/server";
import { generateNonce, buildSignMessage } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/nonce
 * Returns a nonce and the message to sign. Nonce expires in 5 minutes.
 */
export async function GET() {
  try {
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
    const message = err instanceof Error ? err.message : "Nonce error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
