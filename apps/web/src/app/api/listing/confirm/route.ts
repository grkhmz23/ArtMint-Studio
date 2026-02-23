import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyTransaction } from "@/lib/solana-verify";
import { getConnection } from "@/lib/rpc";

export const dynamic = "force-dynamic";

// Max request body size: 2KB
const MAX_BODY_SIZE = 2 * 1024;

const confirmListingSchema = z.object({
  mintAddress: z.string().min(32).max(50),
  txSignature: z.string().min(64).max(128),
  saleStateKey: z.string().min(32).max(50),
});

/**
 * POST /api/listing/confirm
 * 
 * Confirms a listing after the client has submitted the transaction to the blockchain.
 * 
 * Uses the RPC manager for automatic failover.
 * 
 * Flow:
 * 1. Validates authentication and rate limits
 * 2. Verifies the pending listing exists
 * 3. Verifies the transaction on-chain
 * 4. Confirms the sale state account was created
 * 5. Updates listing status to "active"
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authentication
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const wallet = authResult;

    // 2. Rate limiting
    const clientIp = getClientIp(req);
    const rateLimit = await checkRateLimit(`listing:confirm:${clientIp}`, 10, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", code: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.resetMs / 1000)) } }
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

    // 4. Parse and validate request
    const body = await req.json();
    const parsed = confirmListingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { mintAddress, txSignature, saleStateKey } = parsed.data;

    // 5. Check for TX signature replay
    const existingTx = await prisma.listing.findFirst({
      where: { txSignature },
    });

    if (existingTx) {
      return NextResponse.json(
        { error: "Transaction signature already used", code: "tx_replay" },
        { status: 409 }
      );
    }

    // 6. Verify the pending listing exists
    const listing = await prisma.listing.findUnique({
      where: { mintAddress },
      include: { mint: true },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found. Call /api/listing/prepare first." },
        { status: 404 }
      );
    }

    if (listing.mint.wallet !== wallet) {
      return NextResponse.json(
        { error: "Only the owner can confirm this listing" },
        { status: 403 }
      );
    }

    if (listing.status === "active") {
      return NextResponse.json(
        { error: "Listing is already active" },
        { status: 409 }
      );
    }

    // Verify the saleStateKey matches what we prepared
    if (listing.saleStateKey && listing.saleStateKey !== saleStateKey) {
      return NextResponse.json(
        { error: "Sale state key mismatch. Please prepare a new listing." },
        { status: 400 }
      );
    }

    // 7. Verify the transaction on-chain using RPC manager
    const verifyResult = await verifyTransaction(txSignature, wallet);
    
    if (!verifyResult.valid) {
      return NextResponse.json(
        { 
          error: verifyResult.error || "Transaction verification failed",
          code: "tx_verification_failed"
        },
        { status: 400 }
      );
    }

    // 8. Additional verification: Check the sale state account exists using RPC manager
    const connection = getConnection();

    try {
      const saleStateAccount = await connection.getAccountInfo(
        new PublicKey(saleStateKey)
      );
      
      if (!saleStateAccount) {
        return NextResponse.json(
          { 
            error: "Sale state account not found. Transaction may still be processing.",
            code: "account_not_found"
          },
          { status: 202 } // Accepted but not yet processed
        );
      }
    } catch (err) {
      console.error("Failed to check sale state account:", err);
      // Continue anyway - the transaction was verified, account might exist
    }

    // 9. Update listing to active
    const updatedListing = await prisma.listing.update({
      where: { mintAddress },
      data: {
        status: "active",
        txSignature,
        saleStateKey,
        updatedAt: new Date(),
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        type: "listing",
        wallet,
        mintAddress,
        metadata: JSON.stringify({
          priceLamports: updatedListing.priceLamports.toString(),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      listing: {
        mintAddress: updatedListing.mintAddress,
        priceLamports: updatedListing.priceLamports.toString(),
        priceSol: Number(updatedListing.priceLamports) / 1e9,
        status: updatedListing.status,
        txSignature: updatedListing.txSignature,
        saleStateKey: updatedListing.saleStateKey,
      },
    });

  } catch (err) {
    console.error("Listing confirmation error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Failed to confirm listing" },
      { status: 500 }
    );
  }
}
