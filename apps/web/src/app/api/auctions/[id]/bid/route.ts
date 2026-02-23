import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { notifyBidPlaced, notifyOutbid, notifyAuctionWon } from "@/lib/notifications";

// POST /api/auctions/[id]/bid - Place bid or buy (Dutch)
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
    const { amountSol } = body;

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
    if (auction.type === "dutch") {
      const currentPrice = calculateDutchPrice(auction);
      
      // Allow small buffer (2%) for price changes during transaction
      const minAcceptable = (currentPrice * BigInt(98)) / BigInt(100);
      const bidAmount = BigInt(Math.floor(amountSol * 1e9));
      
      if (bidAmount < minAcceptable) {
        return NextResponse.json(
          { 
            error: "Price has changed, please refresh",
            currentPriceSol: Number(currentPrice) / 1e9,
          },
          { status: 400 }
        );
      }

      // Create bid at current price
      await prisma.bid.create({
        data: {
          auctionId: id,
          bidder,
          amount: currentPrice,
        },
      });

      // End auction and transfer ownership
      await prisma.auction.update({
        where: { id },
        data: {
          status: "ended",
          highestBid: currentPrice,
          highestBidder: bidder,
          endTime: new Date(),
        },
      });

      // Update mint ownership
      await prisma.mint.update({
        where: { mintAddress: auction.mintAddress },
        data: {
          wallet: bidder,
        },
      });

      // Notify seller
      await notifyAuctionWon(
        bidder,
        auction.sellerWallet,
        auction.mintAddress,
        Number(currentPrice) / 1e9,
        id
      );

      // Log activity
      await prisma.activity.create({
        data: {
          type: "dutch_purchase",
          wallet: bidder,
          mintAddress: auction.mintAddress,
          metadata: JSON.stringify({
            auctionId: id,
            amountLamports: currentPrice.toString(),
            seller: auction.sellerWallet,
          }),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Purchased!",
        priceSol: Number(currentPrice) / 1e9,
      });
    }

    // English auction - place bid
    if (auction.type === "english") {
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

      // Notify previous bidder they were outbid
      if (auction.highestBidder && auction.highestBidder !== bidder) {
        await notifyOutbid(
          auction.highestBidder,
          bidder,
          auction.mintAddress,
          amountSol,
          id
        );
      }

      // Notify seller of new bid
      await notifyBidPlaced(
        auction.sellerWallet,
        bidder,
        auction.mintAddress,
        amountSol,
        id
      );

      // Update auction
      await prisma.auction.update({
        where: { id },
        data: {
          highestBid: bidAmount,
          highestBidder: bidder,
        },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          type: "bid",
          wallet: bidder,
          mintAddress: auction.mintAddress,
          metadata: JSON.stringify({
            auctionId: id,
            amountLamports: bidAmount.toString(),
          }),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Bid placed!",
        bidSol: amountSol,
      });
    }

    return NextResponse.json({ error: "Invalid auction type" }, { status: 400 });
  } catch (err) {
    console.error("Bid POST error:", err);
    return NextResponse.json({ error: "Failed to process bid" }, { status: 500 });
  }
}

// Calculate current Dutch auction price (linear decay)
function calculateDutchPrice(auction: {
  startPriceLamports: bigint;
  reservePriceLamports: bigint | null;
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
  const reservePrice = auction.reservePriceLamports 
    ? Number(auction.reservePriceLamports)
    : startPrice * 0.1;

  const currentPrice = startPrice - (startPrice - reservePrice) * progress;
  return BigInt(Math.floor(Math.max(currentPrice, reservePrice)));
}
