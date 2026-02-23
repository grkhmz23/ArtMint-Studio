import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const wallet = authResult;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // "global", "following", "personal"
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

    const skip = (page - 1) * limit;

    let where: any = {};

    switch (type) {
      case "personal":
        // User's own activity
        where = { wallet };
        break;
      case "following":
        // Activity from people user follows
        const following = await prisma.follow.findMany({
          where: { followerWallet: wallet },
          select: { followingWallet: true },
        });
        const followingWallets = following.map((f) => f.followingWallet);
        where = {
          OR: [
            { wallet: { in: followingWallets } },
            { targetWallet: wallet }, // Activity where user is target
          ],
        };
        break;
      case "global":
      default:
        // All public activity
        where = {};
        break;
    }

    const activities = await prisma.activity.findMany({
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
      skip,
      take: limit + 1,
    });

    const hasMore = activities.length > limit;
    const items = hasMore ? activities.slice(0, limit) : activities;

    // Format for response
    const formattedActivities = items.map((a) => ({
      id: a.id,
      type: a.type,
      wallet: a.wallet,
      targetWallet: a.targetWallet,
      mint: a.mint
        ? {
            mintAddress: a.mint.mintAddress,
            title: a.mint.title,
            imageUrl: a.mint.imageUrl,
            artist: a.mint.wallet,
          }
        : null,
      metadata: a.metadata ? JSON.parse(a.metadata) : null,
      createdAt: a.createdAt.toISOString(),
    }));

    return NextResponse.json({
      activities: formattedActivities,
      hasMore,
      page,
    });
  } catch (err) {
    console.error("Activity feed error:", err);
    return NextResponse.json({ error: "Failed to load activity" }, { status: 500 });
  }
}
