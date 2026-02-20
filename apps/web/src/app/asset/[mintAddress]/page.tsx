import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { AssetClient } from "./AssetClient";

interface PageProps {
  params: { mintAddress: string };
}

export default async function AssetPage({ params }: PageProps) {
  const mint = await prisma.mint.findUnique({
    where: { mintAddress: params.mintAddress },
    include: { listing: true },
  });

  if (!mint) {
    notFound();
  }

  const listing = mint.listing
    ? {
        ...mint.listing,
        priceLamports: mint.listing.priceLamports.toString(),
      }
    : null;

  return (
    <AssetClient
      mint={{
        ...mint,
        listing,
      }}
    />
  );
}
