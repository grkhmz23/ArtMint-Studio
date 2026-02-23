import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/auctions/[id] - Get auction details
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const auction = await prisma.auction.findUnique({
      where: { id },
      include: {
        mint: {
          select: {
            mintAddress: true,
            title: true,
            imageUrl: true,
            wallet: true,
            inputJson: true,
          },
        },
        bids: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!auction) {
      return NextResponse.json({ error: "Auction not found" }, { status: 404 });
    }

    // Check if auction should be ended
    if (auction.status === "active" && auction.endTime < new Date()) {
      await prisma.auction.update({
        where: { id },
        data: { status: "ended" },
      });
      auction.status = "ended";
    }

    return NextResponse.json({
      auction: {
        id: auction.id,
        mintAddress: auction.mintAddress,
        sellerWallet: auction.sellerWallet,
        startPriceLamports: auction.startPriceLamports.toString(),
        startPriceSol: Number(auction.startPriceLamports) / 1e9,
        reservePriceLamports: auction.reservePriceLamports?.toString(),
        reservePriceSol: auction.reservePriceLamports ? Number(auction.reservePriceLamports) / 1e9 : null,
        minBidIncrement: auction.minBidIncrement.toString(),
        minBidIncrementSol: Number(auction.minBidIncrement) / 1e9,
        type: auction.type,
        startTime: auction.startTime.toISOString(),
        endTime: auction.endTime.toISOString(),
        status: auction.status,
        highestBid: auction.highestBid?.toString(),
        highestBidSol: auction.highestBid ? Number(auction.highestBid) / 1e9 : null,
        highestBidder: auction.highestBidder,
        mint: auction.mint,
        bids: auction.bids.map((b) => ({
          id: b.id,
          bidder: b.bidder,
          amountLamports: b.amount.toString(),
          amountSol: Number(b.amount) / 1e9,
          createdAt: b.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    console.error("Auction GET error:", err);
    return NextResponse.json({ error: "Failed to load auction" }, { status: 500 });
  }
}

// POST /api/auctions/[id] - Place bid or buy (Dutch)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const bidder = authResult;

    const { id } = params;
    const body = await req.json();
    const { amountSol, action } = body; // action: "bid" | "buy"

    const auction = await prisma.auction.findUnique({
      where: { id },
    });

    if (!auction) {
      return NextResponse.json({ error: "Auction not found" }, { status: 404 });
    }

    if (auction.status !== "active") {
      return NextResponse.json(
        { error: `Auction is ${auction.status}` },
        { status: 400 }
      );
    }

    if (auction.endTime < new Date()) {
      await prisma.auction.update({
        where: { id },
        data: { status: "ended" },
      });
      return NextResponse.json({ error: "Auction has ended" }, { status: 400 });
    }

    if (auction.sellerWallet === bidder) {
      return NextResponse.json(
        { error: "Cannot bid on your own auction" },
        { status: 400 }
      );
    }

    // Dutch auction - buy at current price
    if (auction.type === "dutch" && action === "buy") {
      const currentPrice = calculateDutchPrice(auction);
      
      // Create bid at current price
      await prisma.bid.create({
        data: {
          auctionId: id,
          bidder,
          amount: currentPrice,
        },
      });

      // End auction
      await prisma.auction.update({
        where: { id },
        data: {
          status: "ended",
          highestBid: currentPrice,
          highestBidder: bidder,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Purchased!",
        priceSol: Number(currentPrice) / 1e9,
      });
    }

    // English auction - place bid
    if (auction.type === "english" && action === "bid") {
      if (!amountSol || amountSol <= 0) {
        return NextResponse.json({ error: "Invalid bid amount" }, { status: 400 });
      }

      const bidAmount = BigInt(Math.floor(amountSol * 1e9));
      const minBid = auction.highestBid 
        ? auction.highestBid + auction.minBidIncrement
        : auction.startPriceLamports;

      if (bidAmount < minBid) {
        return NextResponse.json(
          { 
            error: `Minimum bid is ${Number(minBid) / 1e9} SOL`,
            minBidSol: Number(minBid) / 1e9,
          },
          { status: 400 }
        );
      }

      // Create bid
      await prisma.bid.create({
        data: {
          auctionId: id,
          bidder,
          amount: bidAmount,
        },
      });

      // Update auction
      await prisma.auction.update({
        where: { id },
        data: {
          highestBid: bidAmount,
          highestBidder: bidder,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Bid placed!",
        bidSol: amountSol,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Auction POST error:", err);
    return NextResponse.json({ error: "Failed to process" }, { status: 500 });
  }
}

// DELETE /api/auctions/[id] - Cancel auction (seller only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const wallet = authResult;

    const { id } = params;

    const auction = await prisma.auction.findUnique({
      where: { id },
    });

    if (!auction) {
      return NextResponse.json({ error: "Auction not found" }, { status: 404 });
    }

    if (auction.sellerWallet !== wallet) {
      return NextResponse.json(
        { error: "Only seller can cancel" },
        { status: 403 }
      );
    }

    if (auction.status !== "active") {
      return NextResponse.json(
        { error: `Auction is already ${auction.status}` },
        { status: 400 }
      );
    }

    // Check if there are bids
    const bidCount = await prisma.bid.count({
      where: { auctionId: id },
    });

    if (bidCount > 0) {
      return NextResponse.json(
        { error: "Cannot cancel auction with bids" },
        { status: 400 }
      );
    }

    await prisma.auction.update({
      where: { id },
      data: { status: "cancelled" },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Auction DELETE error:", err);
    return NextResponse.json({ error: "Failed to cancel" }, { status: 500 });
  }
}

// Calculate current Dutch auction price (linear decay)
function calculateDutchPrice(auction: {
  startPriceLamports: bigint;
  startTime: Date;
  endTime: Date;
}): bigint {
  const now = Date.now();
  const start = auction.startTime.getTime();
  const end = auction.endTime.getTime();
  const totalDuration = end - start;
  const elapsed = now - start;
  const progress = Math.min(elapsed / totalDuration, 1);

  const startPrice = Number(auction.startPriceLamports);
  const endPrice = startPrice * 0.1; // Drops to 10% of start price

  const currentPrice = startPrice - (startPrice - endPrice) * progress;
  return BigInt(Math.floor(currentPrice));
}
