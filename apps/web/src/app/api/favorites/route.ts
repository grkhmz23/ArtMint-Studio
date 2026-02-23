import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { notifyFavorite } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// GET /api/favorites - Get user's favorites
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const wallet = authResult;

    const { searchParams } = new URL(req.url);
    const mintAddress = searchParams.get("mintAddress");

    // If mintAddress provided, check if user favorited it
    if (mintAddress) {
      const favorite = await prisma.favorite.findUnique({
        where: {
          wallet_mintAddress: {
            wallet,
            mintAddress,
          },
        },
      });
      return NextResponse.json({
        isFavorited: !!favorite,
      });
    }

    // Otherwise return all favorites
    const favorites = await prisma.favorite.findMany({
      where: { wallet },
      include: {
        mint: {
          select: {
            mintAddress: true,
            title: true,
            imageUrl: true,
            wallet: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      favorites: favorites.map((f) => ({
        id: f.id,
        mintAddress: f.mintAddress,
        title: f.mint.title,
        imageUrl: f.mint.imageUrl,
        artist: f.mint.wallet,
        createdAt: f.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("Favorites GET error:", err);
    return NextResponse.json({ error: "Failed to load favorites" }, { status: 500 });
  }
}

// POST /api/favorites - Add to favorites
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const wallet = authResult;

    // Rate limit
    const clientIp = getClientIp(req);
    const rateLimit = await checkRateLimit(`favorites:${clientIp}`, 30, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    const body = await req.json();
    const { mintAddress } = body;

    if (!mintAddress) {
      return NextResponse.json({ error: "mintAddress required" }, { status: 400 });
    }

    // Verify mint exists
    const mint = await prisma.mint.findUnique({
      where: { mintAddress },
    });
    if (!mint) {
      return NextResponse.json({ error: "Mint not found" }, { status: 404 });
    }

    // Create favorite
    await prisma.favorite.create({
      data: {
        wallet,
        mintAddress,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        type: "favorite",
        wallet,
        mintAddress,
      },
    });

    // Notify owner (but not if favoriting own work)
    if (mint.wallet !== wallet) {
      await notifyFavorite(mint.wallet, wallet, mintAddress);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.code === "P2002") {
      // Already favorited
      return NextResponse.json({ error: "Already favorited" }, { status: 409 });
    }
    console.error("Favorites POST error:", err);
    return NextResponse.json({ error: "Failed to add favorite" }, { status: 500 });
  }
}

// DELETE /api/favorites - Remove from favorites
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const wallet = authResult;

    const { searchParams } = new URL(req.url);
    const mintAddress = searchParams.get("mintAddress");

    if (!mintAddress) {
      return NextResponse.json({ error: "mintAddress required" }, { status: 400 });
    }

    await prisma.favorite.delete({
      where: {
        wallet_mintAddress: {
          wallet,
          mintAddress,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.code === "P2025") {
      return NextResponse.json({ error: "Not favorited" }, { status: 404 });
    }
    console.error("Favorites DELETE error:", err);
    return NextResponse.json({ error: "Failed to remove favorite" }, { status: 500 });
  }
}
