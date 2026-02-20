import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { verifyTransaction } from "@/lib/solana-verify";

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

    const body = await req.json();
    const parsed = confirmSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { placeholderMintAddress, mintAddress, txSignature } = parsed.data;

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

    if (!existingMint.mintAddress.startsWith("pending-")) {
      return NextResponse.json(
        { error: "Mint already confirmed" },
        { status: 409 }
      );
    }

    // Verify the transaction on-chain
    const txResult = await verifyTransaction(txSignature, wallet, mintAddress);
    if (!txResult.valid) {
      return NextResponse.json(
        { error: `Transaction verification failed: ${txResult.error}` },
        { status: 400 }
      );
    }

    await prisma.mint.update({
      where: { mintAddress: placeholderMintAddress },
      data: { mintAddress },
    });

    return NextResponse.json({ success: true, mintAddress });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Confirm error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
