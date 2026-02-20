import { NextRequest, NextResponse } from "next/server";
import { getSessionWallet } from "@/lib/auth";
import { getQuotaInfo } from "@/lib/quota";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard
 * Returns aggregated dashboard data for the authenticated user.
 */
export async function GET(req: NextRequest) {
  const wallet = await getSessionWallet(req);
  if (!wallet) {
    return NextResponse.json({ authenticated: false });
  }

  const [
    totalMints,
    confirmedMints,
    activeListings,
    listingValueAgg,
    recentMints,
    recentDrafts,
    quota,
  ] = await Promise.all([
    prisma.mint.count({ where: { wallet } }),
    prisma.mint.count({ where: { wallet, status: "confirmed" } }),
    prisma.listing.count({
      where: { status: "active", mint: { wallet } },
    }),
    prisma.listing.aggregate({
      _sum: { priceLamports: true },
      where: { status: "active", mint: { wallet } },
    }),
    prisma.mint.findMany({
      where: { wallet },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { listing: { select: { priceLamports: true, status: true } } },
    }),
    prisma.draft.findMany({
      where: { wallet },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    getQuotaInfo(wallet, "ai_variation"),
  ]);

  const totalListingValue =
    Number(listingValueAgg._sum.priceLamports ?? 0) / 1e9; // lamports → SOL

  const recentActivity = recentMints.map((m) => ({
    id: m.id,
    type: m.listing ? ("listing" as const) : ("mint" as const),
    title: m.title ?? m.mintAddress.slice(0, 8) + "...",
    mintAddress: m.mintAddress,
    status: m.listing?.status ?? m.status,
    timestamp: m.createdAt.toISOString(),
  }));

  return NextResponse.json({
    authenticated: true,
    wallet,
    stats: {
      totalMints,
      confirmedMints,
      activeListings,
      totalListingValue,
    },
    recentMints: recentMints.map((m) => ({
      id: m.id,
      mintAddress: m.mintAddress,
      title: m.title,
      imageUrl: m.imageUrl,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
      listing: m.listing
        ? {
            priceLamports: m.listing.priceLamports.toString(),
            status: m.listing.status,
          }
        : null,
    })),
    recentActivity,
    drafts: recentDrafts.map((d) => ({
      id: d.id,
      type: d.type,
      title: d.title,
      imageUrl: d.imageUrl,
      updatedAt: d.updatedAt.toISOString(),
    })),
    quota: { remaining: quota.remaining, limit: quota.limit },
  });
}
