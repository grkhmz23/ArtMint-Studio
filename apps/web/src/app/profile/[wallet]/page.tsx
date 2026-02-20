import { prisma } from "@/lib/db";
import { ProfileClient } from "./ProfileClient";

interface PageProps {
  params: { wallet: string };
}

export default async function ProfilePage({ params }: PageProps) {
  const mints = await prisma.mint.findMany({
    where: { wallet: params.wallet },
    include: { listing: true },
    orderBy: { createdAt: "desc" },
  });

  const serialized = mints.map((m) => ({
    ...m,
    listing: m.listing
      ? {
          ...m.listing,
          priceLamports: m.listing.priceLamports.toString(),
        }
      : null,
  }));

  return <ProfileClient wallet={params.wallet} mints={serialized} />;
}
