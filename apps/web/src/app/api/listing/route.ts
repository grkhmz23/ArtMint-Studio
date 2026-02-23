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

/**
 * POST /api/listing
 * 
 * ⚠️ DEPRECATED: This endpoint is being replaced by the 3-step listing flow:
 *   1. POST /api/listing/prepare - Get unsigned transaction
 *   2. Client signs and submits to blockchain
 *   3. POST /api/listing/confirm - Confirm on-chain
 * 
 * This endpoint is kept for backward compatibility during migration.
 * New code should use the /prepare and /confirm endpoints.
 */
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

    // If txSignature is provided, this is a confirmation call (backward compatibility)
    // Redirect to the new confirm endpoint logic
    if (parsed.data.txSignature) {
      return NextResponse.json(
        { 
          error: "Use POST /api/listing/confirm for transaction confirmation",
          code: "use_confirm_endpoint",
          redirect: "/api/listing/confirm"
        },
        { status: 308 } // Permanent Redirect
      );
    }

    // If no txSignature, this is a new listing request
    // Redirect to the new prepare endpoint
    return NextResponse.json(
      { 
        error: "Use POST /api/listing/prepare to create a new listing",
        code: "use_prepare_endpoint",
        redirect: "/api/listing/prepare",
        message: "The listing flow has been updated. Please use the new 3-step process: 1) POST /api/listing/prepare, 2) Sign transaction client-side, 3) POST /api/listing/confirm"
      },
      { status: 308 } // Permanent Redirect
    );

  } catch (err) {
    console.error("Listing error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Listing failed" }, { status: 500 });
  }
}

/**
 * GET /api/listing
 * 
 * Get listing information for a mint.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mintAddress = searchParams.get("mintAddress");

    if (!mintAddress) {
      return NextResponse.json(
        { error: "mintAddress query parameter required" },
        { status: 400 }
      );
    }

    const listing = await prisma.listing.findUnique({
      where: { mintAddress },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      listing: {
        ...listing,
        priceLamports: listing.priceLamports.toString(),
      },
    });
  } catch (err) {
    console.error("Get listing error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to get listing" }, { status: 500 });
  }
}
