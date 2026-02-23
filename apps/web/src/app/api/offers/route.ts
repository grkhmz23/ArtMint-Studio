import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { notifyOfferReceived } from "@/lib/notifications";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET /api/offers - List offers
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mintAddress = searchParams.get("mintAddress");
    const buyerWallet = searchParams.get("buyerWallet");
    const sellerWallet = searchParams.get("sellerWallet");
    const type = searchParams.get("type"); // "sent" | "received"

    const where: any = {};
    if (mintAddress) where.mintAddress = mintAddress;
    if (buyerWallet) where.buyerWallet = buyerWallet;
    if (sellerWallet) where.sellerWallet = sellerWallet;
    
    // Default to active offers
    where.status = "active";
    where.expiresAt = { gt: new Date() };

    const offers = await prisma.offer.findMany({
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
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      offers: offers.map((o) => ({
        id: o.id,
        mintAddress: o.mintAddress,
        buyerWallet: o.buyerWallet,
        sellerWallet: o.sellerWallet,
        priceLamports: o.priceLamports.toString(),
        priceSol: Number(o.priceLamports) / 1e9,
        status: o.status,
        expiresAt: o.expiresAt.toISOString(),
        createdAt: o.createdAt.toISOString(),
        mint: o.mint,
      })),
    });
  } catch (err) {
    console.error("Offers GET error:", err);
    return NextResponse.json({ error: "Failed to load offers" }, { status: 500 });
  }
}

// POST /api/offers - Create offer
const createSchema = z.object({
  mintAddress: z.string().min(1),
  priceLamports: z.string().regex(/^\d+$/),
  expiresInHours: z.number().int().min(1).max(168).default(72), // Max 1 week
});

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const buyerWallet = authResult;

    // Rate limit
    const clientIp = getClientIp(req);
    const rateLimit = await checkRateLimit(`offers:create:${clientIp}`, 10, 60_000);
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

    const { mintAddress, priceLamports, expiresInHours } = parsed.data;
    const priceBigInt = BigInt(priceLamports);

    // Verify mint exists and get owner
    const mint = await prisma.mint.findUnique({
      where: { mintAddress },
    });

    if (!mint) {
      return NextResponse.json({ error: "NFT not found" }, { status: 404 });
    }

    if (mint.wallet === buyerWallet) {
      return NextResponse.json(
        { error: "Cannot make offer on your own NFT" },
        { status: 400 }
      );
    }

    // Check if already has active offer from this buyer
    const existingOffer = await prisma.offer.findFirst({
      where: {
        mintAddress,
        buyerWallet,
        status: "active",
        expiresAt: { gt: new Date() },
      },
    });

    if (existingOffer) {
      // Update existing offer
      const updated = await prisma.offer.update({
        where: { id: existingOffer.id },
        data: {
          priceLamports: priceBigInt,
          expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
        },
      });

      return NextResponse.json({
        success: true,
        offer: {
          id: updated.id,
          priceLamports: updated.priceLamports.toString(),
          expiresAt: updated.expiresAt.toISOString(),
        },
        message: "Offer updated",
      });
    }

    // Create new offer
    const offer = await prisma.offer.create({
      data: {
        mintAddress,
        buyerWallet,
        sellerWallet: mint.wallet,
        priceLamports: priceBigInt,
        expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        type: "offer",
        wallet: buyerWallet,
        targetWallet: mint.wallet,
        mintAddress,
        metadata: JSON.stringify({
          priceLamports: priceLamports,
          offerId: offer.id,
        }),
      },
    });

    // Send notification to seller
    await notifyOfferReceived(
      mint.wallet,
      buyerWallet,
      mintAddress,
      Number(priceLamports) / 1e9
    );

    return NextResponse.json({
      success: true,
      offer: {
        id: offer.id,
        priceLamports: offer.priceLamports.toString(),
        expiresAt: offer.expiresAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("Offers POST error:", err);
    return NextResponse.json({ error: "Failed to create offer" }, { status: 500 });
  }
}
