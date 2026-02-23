import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET /api/auctions - List auctions
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "active";
    const type = searchParams.get("type"); // "english" | "dutch"
    const seller = searchParams.get("seller");

    const where: any = { status };
    if (type) where.type = type;
    if (seller) where.sellerWallet = seller;

    // For active auctions, filter by end time
    if (status === "active") {
      where.endTime = { gt: new Date() };
    }

    const auctions = await prisma.auction.findMany({
      where,
      include: {
        mint: {
          select: {
            mintAddress: true,
            title: true,
            imageUrl: true,
            wallet: true,
          },
        },
        _count: {
          select: { bids: true },
        },
      },
      orderBy: { endTime: "asc" },
    });

    return NextResponse.json({
      auctions: auctions.map((a) => ({
        id: a.id,
        mintAddress: a.mintAddress,
        sellerWallet: a.sellerWallet,
        startPriceLamports: a.startPriceLamports.toString(),
        startPriceSol: Number(a.startPriceLamports) / 1e9,
        reservePriceLamports: a.reservePriceLamports?.toString(),
        reservePriceSol: a.reservePriceLamports ? Number(a.reservePriceLamports) / 1e9 : null,
        minBidIncrement: a.minBidIncrement.toString(),
        type: a.type,
        startTime: a.startTime.toISOString(),
        endTime: a.endTime.toISOString(),
        status: a.status,
        highestBid: a.highestBid?.toString(),
        highestBidSol: a.highestBid ? Number(a.highestBid) / 1e9 : null,
        highestBidder: a.highestBidder,
        bidCount: a._count.bids,
        mint: a.mint,
      })),
    });
  } catch (err) {
    console.error("Auctions GET error:", err);
    return NextResponse.json({ error: "Failed to load auctions" }, { status: 500 });
  }
}

// POST /api/auctions - Create auction
const createSchema = z.object({
  mintAddress: z.string().min(1),
  startPriceSol: z.number().positive(),
  reservePriceSol: z.number().positive().optional(),
  minBidIncrementSol: z.number().positive().default(0.05),
  type: z.enum(["english", "dutch"]),
  durationHours: z.number().int().min(1).max(168).default(24),
});

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const sellerWallet = authResult;

    // Rate limit
    const clientIp = getClientIp(req);
    const rateLimit = await checkRateLimit(`auctions:create:${clientIp}`, 5, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { mintAddress, startPriceSol, reservePriceSol, minBidIncrementSol, type, durationHours } = parsed.data;

    // Verify mint exists and belongs to seller
    const mint = await prisma.mint.findUnique({
      where: { mintAddress },
    });

    if (!mint) {
      return NextResponse.json({ error: "NFT not found" }, { status: 404 });
    }

    if (mint.wallet !== sellerWallet) {
      return NextResponse.json(
        { error: "You don't own this NFT" },
        { status: 403 }
      );
    }

    // Check if already has active auction
    const existingAuction = await prisma.auction.findUnique({
      where: { mintAddress },
    });

    if (existingAuction && existingAuction.status === "active" && existingAuction.endTime > new Date()) {
      return NextResponse.json(
        { error: "NFT already has an active auction" },
        { status: 409 }
      );
    }

    // Check if listed
    const listing = await prisma.listing.findUnique({
      where: { mintAddress },
    });

    if (listing && listing.status === "active") {
      return NextResponse.json(
        { error: "Cannot auction a listed NFT. Cancel listing first." },
        { status: 409 }
      );
    }

    const now = new Date();
    const endTime = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

    const auction = await prisma.auction.create({
      data: {
        mintAddress,
        sellerWallet,
        startPriceLamports: BigInt(Math.floor(startPriceSol * 1e9)),
        reservePriceLamports: reservePriceSol ? BigInt(Math.floor(reservePriceSol * 1e9)) : null,
        minBidIncrement: BigInt(Math.floor(minBidIncrementSol * 1e9)),
        type,
        startTime: now,
        endTime,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        type: "auction_created",
        wallet: sellerWallet,
        mintAddress,
        metadata: JSON.stringify({
          auctionId: auction.id,
          type,
          startPrice: startPriceSol,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      auction: {
        id: auction.id,
        mintAddress: auction.mintAddress,
        type: auction.type,
        startPriceSol,
        endTime: auction.endTime.toISOString(),
      },
    });
  } catch (err) {
    console.error("Auctions POST error:", err);
    return NextResponse.json({ error: "Failed to create auction" }, { status: 500 });
  }
}
