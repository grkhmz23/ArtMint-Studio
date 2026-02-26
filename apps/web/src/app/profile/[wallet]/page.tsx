import { prisma } from "@/lib/db";
import { ProfileClient } from "./ProfileClient";
import { notFound } from "next/navigation";

interface PageProps {
  params: { wallet: string } | Promise<{ wallet: string }>;
}

export default async function ProfilePage({ params }: PageProps) {
  const { wallet } = await Promise.resolve(params);
  if (!wallet) notFound();

  const [mints, followerCount, followingCount, profile] = await Promise.all([
    prisma.mint.findMany({
      where: { wallet },
      select: {
        id: true,
        mintAddress: true,
        imageUrl: true,
        title: true,
        hash: true,
        status: true,
        createdAt: true,
        listing: {
          select: {
            status: true,
            priceLamports: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.follow.count({
      where: { followingWallet: wallet },
    }),
    prisma.follow.count({
      where: { followerWallet: wallet },
    }),
    prisma.userProfile.findUnique({
      where: { wallet },
      select: {
        wallet: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        website: true,
        twitter: true,
        discord: true,
        verified: true,
      },
    }),
  ]);

  const serialized = mints.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
    listing: m.listing
      ? {
          ...m.listing,
          priceLamports: m.listing.priceLamports.toString(),
        }
      : null,
  }));

  return (
    <ProfileClient
      wallet={wallet}
      mints={serialized}
      followerCount={followerCount}
      followingCount={followingCount}
      profile={profile}
    />
  );
}
