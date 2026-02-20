import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { verifyTransaction } from "@/lib/solana-verify";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const confirmSchema = z.object({
  placeholderMintAddress: z.string().min(1),
  mintAddress: z.string().min(32).max(50),
  txSignature: z.string().min(64).max(128),
});

export async function POST(req: NextRequest) {
  try {
    // Auth — wallet comes from session
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const wallet = authResult;

    // Rate limit: 10 req/min per IP
    const clientIp = getClientIp(req);
    const ipLimit = await checkRateLimit(`confirm:ip:${clientIp}`, 10, 60_000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", code: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(ipLimit.resetMs / 1000)) } }
      );
    }

    const body = await req.json();
    const parsed = confirmSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    const { placeholderMintAddress, mintAddress, txSignature } = parsed.data;

    // Check for TX signature replay — reject if already used
    const existingTx = await prisma.mint.findFirst({
      where: { txSignature },
    });
    if (existingTx) {
      return NextResponse.json(
        { error: "Transaction signature already used for another mint" },
        { status: 409 }
      );
    }

    // Verify the pending mint exists and belongs to the session wallet
    const existingMint = await prisma.mint.findUnique({
      where: { mintAddress: placeholderMintAddress },
    });

    if (!existingMint) {
      return NextResponse.json(
        { error: "Pending mint not found" },
        { status: 404 }
      );
    }

    if (existingMint.wallet !== wallet) {
      return NextResponse.json(
        { error: "Wallet does not match the original creator" },
        { status: 403 }
      );
    }

    if (existingMint.status === "confirmed") {
      return NextResponse.json(
        { error: "Mint already confirmed" },
        { status: 409 }
      );
    }

    // Verify the transaction on-chain
    const txResult = await verifyTransaction(txSignature, wallet, mintAddress);
    if (!txResult.valid) {
      return NextResponse.json(
        { error: "Transaction verification failed" },
        { status: 400 }
      );
    }

    // Atomically update — set real mint address, tx signature, and status
    await prisma.mint.update({
      where: { mintAddress: placeholderMintAddress },
      data: {
        mintAddress,
        txSignature,
        status: "confirmed",
      },
    });

    return NextResponse.json({ success: true, mintAddress });
  } catch (err) {
    console.error("Mint confirm error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Confirmation failed" }, { status: 500 });
  }
}
