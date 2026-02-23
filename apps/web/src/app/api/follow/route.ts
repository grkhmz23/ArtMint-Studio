import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { notifyFollow } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// GET /api/follow - Check follow status or list followers/following
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetWallet = searchParams.get("targetWallet");
    const type = searchParams.get("type"); // "followers" | "following"
    const check = searchParams.get("check"); // Check if following

    // Check if current user follows target
    if (check && targetWallet) {
      const authResult = await requireAuth(req);
      if (authResult instanceof NextResponse) {
        // Return not following if not authenticated
        return NextResponse.json({ isFollowing: false });
      }
      const currentWallet = authResult;

      const follow = await prisma.follow.findUnique({
        where: {
          followerWallet_followingWallet: {
            followerWallet: currentWallet,
            followingWallet: targetWallet,
          },
        },
      });

      return NextResponse.json({ isFollowing: !!follow });
    }

    // Get followers of a wallet
    if (type === "followers" && targetWallet) {
      const followers = await prisma.follow.findMany({
        where: { followingWallet: targetWallet },
        orderBy: { createdAt: "desc" },
      });

      const count = await prisma.follow.count({
        where: { followingWallet: targetWallet },
      });

      return NextResponse.json({
        followers: followers.map((f) => ({
          wallet: f.followerWallet,
          createdAt: f.createdAt.toISOString(),
        })),
        count,
      });
    }

    // Get who a wallet is following
    if (type === "following" && targetWallet) {
      const following = await prisma.follow.findMany({
        where: { followerWallet: targetWallet },
        orderBy: { createdAt: "desc" },
      });

      const count = await prisma.follow.count({
        where: { followerWallet: targetWallet },
      });

      return NextResponse.json({
        following: following.map((f) => ({
          wallet: f.followingWallet,
          createdAt: f.createdAt.toISOString(),
        })),
        count,
      });
    }

    return NextResponse.json(
      { error: "Invalid parameters. Use targetWallet with type or check" },
      { status: 400 }
    );
  } catch (err) {
    console.error("Follow GET error:", err);
    return NextResponse.json(
      { error: "Failed to load follow data" },
      { status: 500 }
    );
  }
}

// POST /api/follow - Follow a wallet
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const followerWallet = authResult;

    // Rate limit
    const clientIp = getClientIp(req);
    const rateLimit = await checkRateLimit(`follow:${clientIp}`, 20, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    const body = await req.json();
    const { targetWallet } = body;

    if (!targetWallet) {
      return NextResponse.json(
        { error: "targetWallet required" },
        { status: 400 }
      );
    }

    if (targetWallet === followerWallet) {
      return NextResponse.json(
        { error: "Cannot follow yourself" },
        { status: 400 }
      );
    }

    // Create follow
    await prisma.follow.create({
      data: {
        followerWallet,
        followingWallet: targetWallet,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        type: "follow",
        wallet: followerWallet,
        targetWallet: targetWallet,
      },
    });

    // Notify the person being followed
    await notifyFollow(targetWallet, followerWallet);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.code === "P2002") {
      // Already following
      return NextResponse.json(
        { error: "Already following this user" },
        { status: 409 }
      );
    }
    console.error("Follow POST error:", err);
    return NextResponse.json(
      { error: "Failed to follow user" },
      { status: 500 }
    );
  }
}

// DELETE /api/follow - Unfollow a wallet
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const followerWallet = authResult;

    const { searchParams } = new URL(req.url);
    const targetWallet = searchParams.get("targetWallet");

    if (!targetWallet) {
      return NextResponse.json(
        { error: "targetWallet required" },
        { status: 400 }
      );
    }

    await prisma.follow.delete({
      where: {
        followerWallet_followingWallet: {
          followerWallet,
          followingWallet: targetWallet,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.code === "P2025") {
      return NextResponse.json(
        { error: "Not following this user" },
        { status: 404 }
      );
    }
    console.error("Follow DELETE error:", err);
    return NextResponse.json(
      { error: "Failed to unfollow user" },
      { status: 500 }
    );
  }
}
