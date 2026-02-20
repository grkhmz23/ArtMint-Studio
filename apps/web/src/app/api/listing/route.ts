import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const listingSchema = z.object({
  mintAddress: z.string().min(1),
  priceLamports: z.string().regex(/^\d+$/, "Must be a positive integer string"),
  txSignature: z.string().optional(),
  saleStateKey: z.string().optional(),
  // Status is server-determined — NOT accepted from client
});

export async function POST(req: NextRequest) {
  try {
    // Auth — wallet comes from session
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const wallet = authResult;

    // Rate limit: 10 req/min per IP
    const clientIp = getClientIp(req);
    const ipLimit = await checkRateLimit(`listing:ip:${clientIp}`, 10, 60_000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", code: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(ipLimit.resetMs / 1000)) } }
      );
    }

    const body = await req.json();
    const parsed = listingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    // Verify the mint exists and belongs to the session wallet
    const mint = await prisma.mint.findUnique({
      where: { mintAddress: parsed.data.mintAddress },
    });

    if (!mint) {
      return NextResponse.json({ error: "Mint not found" }, { status: 404 });
    }

    if (mint.wallet !== wallet) {
      return NextResponse.json(
        { error: "Only the creator can list this item" },
        { status: 403 }
      );
    }

    const priceBigInt = BigInt(parsed.data.priceLamports);
    if (priceBigInt <= BigInt(0)) {
      return NextResponse.json(
        { error: "Price must be greater than zero" },
        { status: 400 }
      );
    }
    if (priceBigInt > BigInt("1000000000000000000")) {
      return NextResponse.json(
        { error: "Price exceeds maximum allowed" },
        { status: 400 }
      );
    }

    // Status is server-determined: new listings are "pending", existing stay as-is on price update
    const listing = await prisma.listing.upsert({
      where: { mintAddress: parsed.data.mintAddress },
      update: {
        priceLamports: priceBigInt,
        txSignature: parsed.data.txSignature,
        saleStateKey: parsed.data.saleStateKey,
      },
      create: {
        mintAddress: parsed.data.mintAddress,
        priceLamports: priceBigInt,
        txSignature: parsed.data.txSignature,
        saleStateKey: parsed.data.saleStateKey,
        status: "pending",
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
    console.error("Listing error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Listing failed" }, { status: 500 });
  }
}
