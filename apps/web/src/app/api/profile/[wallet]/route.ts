import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/profile/[wallet] - Get public profile for any user
export async function GET(
  req: NextRequest,
  { params }: { params: { wallet: string } }
) {
  try {
    const { wallet } = params;

    const [profile, mintCount, followerCount, followingCount] = await Promise.all([
      prisma.userProfile.findUnique({
        where: { wallet },
      }),
      prisma.mint.count({ where: { wallet } }),
      prisma.follow.count({ where: { followingWallet: wallet } }),
      prisma.follow.count({ where: { followerWallet: wallet } }),
    ]);

    if (!profile) {
      // Return default profile for wallets without one
      return NextResponse.json({
        profile: {
          wallet,
          username: null,
          displayName: null,
          bio: null,
          avatarUrl: null,
          website: null,
          twitter: null,
          discord: null,
          verified: false,
        },
        stats: {
          mintCount,
          followerCount,
          followingCount,
        },
      });
    }

    return NextResponse.json({
      profile,
      stats: {
        mintCount,
        followerCount,
        followingCount,
      },
    });
  } catch (err) {
    console.error("Public profile GET error:", err);
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 }
    );
  }
}
