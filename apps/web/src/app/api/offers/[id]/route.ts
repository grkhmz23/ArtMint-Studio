import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { notifyOfferAccepted, notifyOfferRejected } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// PATCH /api/offers/[id] - Accept, reject, or cancel offer
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const wallet = authResult;

    const { id } = params;
    const body = await req.json();
    const { action } = body; // "accept" | "reject" | "cancel"

    const offer = await prisma.offer.findUnique({
      where: { id },
      include: {
        mint: {
          select: {
            title: true,
            imageUrl: true,
          },
        },
      },
    });

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    if (offer.status !== "active") {
      return NextResponse.json(
        { error: `Offer is already ${offer.status}` },
        { status: 400 }
      );
    }

    if (offer.expiresAt < new Date()) {
      await prisma.offer.update({
        where: { id },
        data: { status: "expired" },
      });
      return NextResponse.json({ error: "Offer has expired" }, { status: 400 });
    }

    switch (action) {
      case "accept":
        // Only seller can accept
        if (offer.sellerWallet !== wallet) {
          return NextResponse.json(
            { error: "Only the seller can accept this offer" },
            { status: 403 }
          );
        }

        await prisma.offer.update({
          where: { id },
          data: { status: "accepted" },
        });

        // Log activity
        await prisma.activity.create({
          data: {
            type: "sale",
            wallet: offer.sellerWallet,
            targetWallet: offer.buyerWallet,
            mintAddress: offer.mintAddress,
            metadata: JSON.stringify({
              priceLamports: offer.priceLamports.toString(),
              offerId: offer.id,
            }),
          },
        });

        // Notify buyer
        await notifyOfferAccepted(
          offer.buyerWallet,
          offer.sellerWallet,
          offer.mintAddress,
          Number(offer.priceLamports) / 1e9
        );

        return NextResponse.json({
          success: true,
          message: "Offer accepted",
          nextStep: "Complete the sale via wallet transaction",
        });

      case "reject":
        // Only seller can reject
        if (offer.sellerWallet !== wallet) {
          return NextResponse.json(
            { error: "Only the seller can reject this offer" },
            { status: 403 }
          );
        }

        await prisma.offer.update({
          where: { id },
          data: { status: "rejected" },
        });

        // Notify buyer
        await notifyOfferRejected(
          offer.buyerWallet,
          offer.sellerWallet,
          offer.mintAddress,
          Number(offer.priceLamports) / 1e9
        );

        return NextResponse.json({ success: true, message: "Offer rejected" });

      case "cancel":
        // Only buyer can cancel
        if (offer.buyerWallet !== wallet) {
          return NextResponse.json(
            { error: "Only the buyer can cancel this offer" },
            { status: 403 }
          );
        }

        await prisma.offer.update({
          where: { id },
          data: { status: "cancelled" },
        });

        return NextResponse.json({ success: true, message: "Offer cancelled" });

      default:
        return NextResponse.json(
          { error: "Invalid action. Use: accept, reject, cancel" },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("Offer PATCH error:", err);
    return NextResponse.json({ error: "Failed to update offer" }, { status: 500 });
  }
}

// GET /api/offers/[id] - Get offer details
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const offer = await prisma.offer.findUnique({
      where: { id },
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
    });

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    return NextResponse.json({
      offer: {
        id: offer.id,
        mintAddress: offer.mintAddress,
        buyerWallet: offer.buyerWallet,
        sellerWallet: offer.sellerWallet,
        priceLamports: offer.priceLamports.toString(),
        priceSol: Number(offer.priceLamports) / 1e9,
        status: offer.status,
        expiresAt: offer.expiresAt.toISOString(),
        createdAt: offer.createdAt.toISOString(),
        mint: offer.mint,
      },
    });
  } catch (err) {
    console.error("Offer GET error:", err);
    return NextResponse.json({ error: "Failed to load offer" }, { status: 500 });
  }
}
