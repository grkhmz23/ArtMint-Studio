import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { MintMetadataValidationError, prepareMintNftTransaction } from "@artmint/exchangeart";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getConnection } from "@/lib/rpc";

export const dynamic = "force-dynamic";

const MAX_BODY_SIZE = 1024;
const BLOCKHASH_VALIDITY_MS = 60_000;

const prepareMintSchema = z.object({
  placeholderMintAddress: z.string().min(1),
});

/**
 * POST /api/mint/prepare
 *
 * Builds a partially signed NFT mint transaction for a pending ArtMint record.
 * The server signs the generated mint keypair; the client only signs with the wallet.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const wallet = authResult;

    const clientIp = getClientIp(req);
    const ipLimit = await checkRateLimit(`mint:prepare:ip:${clientIp}`, 10, 60_000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", code: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(ipLimit.resetMs / 1000)) } }
      );
    }

    const walletLimit = await checkRateLimit(`mint:prepare:wallet:${wallet}`, 5, 60_000);
    if (!walletLimit.allowed) {
      return NextResponse.json(
        { error: "Too many mint attempts. Please wait a moment.", code: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(walletLimit.resetMs / 1000)) } }
      );
    }

    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }

    const body = await req.json();
    const parsed = prepareMintSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { placeholderMintAddress } = parsed.data;
    const pendingMint = await prisma.mint.findUnique({
      where: { mintAddress: placeholderMintAddress },
    });

    if (!pendingMint) {
      return NextResponse.json({ error: "Pending mint not found" }, { status: 404 });
    }
    if (pendingMint.wallet !== wallet) {
      return NextResponse.json({ error: "Only the creator can mint this asset" }, { status: 403 });
    }
    if (pendingMint.status === "confirmed") {
      return NextResponse.json(
        { error: "Mint already confirmed", mintAddress: pendingMint.mintAddress },
        { status: 409 }
      );
    }
    if (!pendingMint.mintAddress.startsWith("pending-")) {
      return NextResponse.json({ error: "Mint record is not pending" }, { status: 400 });
    }

    const connection = getConnection();
    const prepared = await prepareMintNftTransaction({
      connection,
      payer: new PublicKey(wallet),
      metadataUri: pendingMint.metadataUrl,
      name: pendingMint.title ?? "ArtMint",
      symbol: "ARTMINT",
      sellerFeeBasisPoints: 500,
    });

    return NextResponse.json({
      success: true,
      prepared: {
        ...prepared,
        expiresAt: new Date(Date.now() + BLOCKHASH_VALIDITY_MS).toISOString(),
      },
      pendingMint: {
        placeholderMintAddress,
        title: pendingMint.title,
        metadataUrl: pendingMint.metadataUrl,
      },
    });
  } catch (err) {
    if (err instanceof MintMetadataValidationError) {
      return NextResponse.json(
        { error: err.message, code: "invalid_mint_metadata" },
        { status: 400 }
      );
    }
    console.error("Mint prepare transaction error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to prepare mint transaction" }, { status: 500 });
  }
}
