import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { prepareListingTransaction } from "@artmint/exchangeart";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyTokenOwnership, validateNftMint } from "@/lib/solana-token";
import { getConnection } from "@/lib/rpc";

export const dynamic = "force-dynamic";

// Max request body size: 1KB
const MAX_BODY_SIZE = 1 * 1024;

// Blockhash validity window (roughly 90 seconds on Solana)
const BLOCKHASH_VALIDITY_MS = 60_000;

const prepareListingSchema = z.object({
  mintAddress: z.string().min(32).max(50),
  priceLamports: z.string().regex(/^\d+$/, "Must be a positive integer string"),
});

/**
 * POST /api/listing/prepare
 * 
 * Prepares a Buy Now listing transaction for client-side signing.
 * 
 * Flow:
 * 1. Validates authentication and rate limits
 * 2. Verifies the mint exists in our database
 * 3. Verifies the user owns the NFT on-chain
 * 4. Builds the listing transaction
 * 5. Returns serialized transaction + signing data
 * 
 * Uses the RPC manager for automatic failover.
 * 
 * The client must:
 * 1. Sign the transaction with their wallet
 * 2. Submit to the blockchain
 * 3. Call /api/listing/confirm with the tx signature
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authentication
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const wallet = authResult;

    // 2. Rate limiting - 5 requests per minute per wallet
    const clientIp = getClientIp(req);
    const ipLimit = await checkRateLimit(`listing:prepare:ip:${clientIp}`, 10, 60_000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later.", code: "rate_limited" },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(ipLimit.resetMs / 1000)) },
        }
      );
    }

    const walletLimit = await checkRateLimit(`listing:prepare:wallet:${wallet}`, 5, 60_000);
    if (!walletLimit.allowed) {
      return NextResponse.json(
        { error: "Too many listing attempts. Please wait a moment.", code: "rate_limited" },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(walletLimit.resetMs / 1000)) },
        }
      );
    }

    // 3. Check body size
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return NextResponse.json(
        { error: "Request body too large" },
        { status: 413 }
      );
    }

    // 4. Parse and validate request body
    const body = await req.json();
    const parsed = prepareListingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { mintAddress, priceLamports: priceLamportsStr } = parsed.data;
    const priceLamports = BigInt(priceLamportsStr);

    // Validate price
    if (priceLamports <= BigInt(0)) {
      return NextResponse.json(
        { error: "Price must be greater than zero" },
        { status: 400 }
      );
    }
    if (priceLamports > BigInt("1000000000000000000")) {
      return NextResponse.json(
        { error: "Price exceeds maximum allowed (1B SOL)" },
        { status: 400 }
      );
    }

    // 5. Verify mint exists in our database
    const mint = await prisma.mint.findUnique({
      where: { mintAddress },
      include: { listing: true },
    });

    if (!mint) {
      return NextResponse.json(
        { error: "Mint not found in database" },
        { status: 404 }
      );
    }

    if (mint.wallet !== wallet) {
      return NextResponse.json(
        { error: "Only the creator can list this NFT" },
        { status: 403 }
      );
    }

    if (mint.status !== "confirmed") {
      return NextResponse.json(
        { error: "NFT mint is not yet confirmed on-chain" },
        { status: 400 }
      );
    }

    // Check if already listed in database
    if (mint.listing && mint.listing.status === "active") {
      return NextResponse.json(
        { error: "NFT is already listed", existingListing: true },
        { status: 409 }
      );
    }

    // 6. Verify on-chain ownership using RPC manager
    const connection = getConnection();

    // Validate the mint exists on-chain
    const mintValidation = await validateNftMint(
      new PublicKey(mintAddress)
    );

    if (!mintValidation.valid) {
      return NextResponse.json(
        { error: mintValidation.error },
        { status: 400 }
      );
    }

    // Verify ownership
    const sellerPubkey = new PublicKey(wallet);
    const ownership = await verifyTokenOwnership(
      sellerPubkey,
      new PublicKey(mintAddress)
    );

    if (!ownership.ownsToken) {
      return NextResponse.json(
        { 
          error: ownership.error || "Wallet does not own this NFT",
          code: "not_owner"
        },
        { status: 403 }
      );
    }

    // 7. Build the listing transaction
    let preparedTx;
    try {
      preparedTx = await prepareListingTransaction({
        connection,
        seller: sellerPubkey,
        mintAddress: new PublicKey(mintAddress),
        priceLamports,
      });
    } catch (err) {
      console.error("Failed to prepare listing transaction:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json(
        { error: `Failed to prepare transaction: ${message}` },
        { status: 500 }
      );
    }

    // 8. Store pending listing in database (prevents duplicate preparations)
    // Use upsert to handle re-preparations (e.g., if blockhash expired)
    await prisma.listing.upsert({
      where: { mintAddress },
      update: {
        priceLamports,
        status: "pending",
        // Clear any previous tx info
        txSignature: null,
        saleStateKey: preparedTx.saleStatePublicKey,
        updatedAt: new Date(),
      },
      create: {
        mintAddress,
        priceLamports,
        status: "pending",
        saleStateKey: preparedTx.saleStatePublicKey,
      },
    });

    // 9. Return prepared transaction data
    return NextResponse.json({
      success: true,
      prepared: {
        serializedTransaction: preparedTx.serializedTransaction,
        saleStatePublicKey: preparedTx.saleStatePublicKey,
        saleStateSecretKey: preparedTx.saleStateSecretKey,
        blockhash: preparedTx.blockhash,
        lastValidBlockHeight: preparedTx.lastValidBlockHeight,
        estimatedFee: preparedTx.estimatedFee,
        expiresAt: new Date(Date.now() + BLOCKHASH_VALIDITY_MS).toISOString(),
      },
      listing: {
        mintAddress,
        priceLamports: priceLamports.toString(),
        priceSol: Number(priceLamports) / 1e9,
      },
    });

  } catch (err) {
    console.error("Listing preparation error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Failed to prepare listing" },
      { status: 500 }
    );
  }
}
