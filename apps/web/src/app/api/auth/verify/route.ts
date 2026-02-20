import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
import {
  buildSignMessage,
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth";

const verifySchema = z.object({
  wallet: z.string().min(32).max(50),
  nonce: z.string().min(1),
  signature: z.string().min(1), // base58-encoded ed25519 signature
});

/**
 * POST /api/auth/verify
 * Verifies the wallet signature over the SIWS message, creates a session.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { wallet, nonce, signature } = parsed.data;

    // 1. Atomically claim the nonce (prevents replay race condition).
    // updateMany with WHERE used=false ensures only one concurrent request succeeds.
    const claimed = await prisma.authNonce.updateMany({
      where: { nonce, used: false, expiresAt: { gt: new Date() } },
      data: { used: true, wallet },
    });

    if (claimed.count === 0) {
      return NextResponse.json(
        { error: "Invalid, expired, or already used nonce" },
        { status: 401 }
      );
    }

    // 2. Verify the ed25519 signature
    const message = buildSignMessage(nonce);
    const messageBytes = new TextEncoder().encode(message);
    let signatureBytes: Uint8Array;
    let publicKeyBytes: Uint8Array;

    try {
      signatureBytes = bs58.decode(signature);
      publicKeyBytes = bs58.decode(wallet);
    } catch {
      return NextResponse.json(
        { error: "Invalid base58 encoding" },
        { status: 400 }
      );
    }

    if (signatureBytes.length !== 64) {
      return NextResponse.json(
        { error: "Invalid signature length" },
        { status: 400 }
      );
    }

    const verified = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    );

    if (!verified) {
      // Signature failed — un-claim the nonce so it can be retried
      await prisma.authNonce.updateMany({
        where: { nonce },
        data: { used: false, wallet: null },
      });
      return NextResponse.json(
        { error: "Signature verification failed" },
        { status: 401 }
      );
    }

    // 4. Create session
    const token = createSessionToken(wallet);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: { token, wallet, expiresAt },
    });

    // 5. Set session cookie and return
    const res = NextResponse.json({
      success: true,
      wallet,
    });

    setSessionCookie(res, token);
    return res;
  } catch (err) {
    console.error("Auth verify error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
