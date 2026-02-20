import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const listingSchema = z.object({
  mintAddress: z.string(),
  priceLamports: z.string(), // BigInt as string
  txSignature: z.string().optional(),
  saleStateKey: z.string().optional(),
  status: z.enum(["pending", "active", "sold", "cancelled"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = listingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const listing = await prisma.listing.upsert({
      where: { mintAddress: parsed.data.mintAddress },
      update: {
        priceLamports: BigInt(parsed.data.priceLamports),
        txSignature: parsed.data.txSignature,
        saleStateKey: parsed.data.saleStateKey,
        status: parsed.data.status ?? "active",
      },
      create: {
        mintAddress: parsed.data.mintAddress,
        priceLamports: BigInt(parsed.data.priceLamports),
        txSignature: parsed.data.txSignature,
        saleStateKey: parsed.data.saleStateKey,
        status: parsed.data.status ?? "pending",
      },
    });

    return NextResponse.json({
      success: true,
      listing: {
        ...listing,
        priceLamports: listing.priceLamports.toString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Listing error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
