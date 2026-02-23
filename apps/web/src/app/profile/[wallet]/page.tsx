import { prisma } from "@/lib/db";
import { ProfileClient } from "./ProfileClient";

interface PageProps {
  params: { wallet: string };
}

export default async function ProfilePage({ params }: PageProps) {
  const [mints, followerCount, followingCount] = await Promise.all([
    prisma.mint.findMany({
      where: { wallet: params.wallet },
      include: { listing: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.follow.count({
      where: { followingWallet: params.wallet },
    }),
    prisma.follow.count({
      where: { followerWallet: params.wallet },
    }),
  ]);

  const serialized = mints.map((m) => ({
    ...m,
    listing: m.listing
      ? {
          ...m.listing,
          priceLamports: m.listing.priceLamports.toString(),
        }
      : null,
  }));

  return (
    <ProfileClient
      wallet={params.wallet}
      mints={serialized}
      followerCount={followerCount}
      followingCount={followingCount}
    />
  );
}
