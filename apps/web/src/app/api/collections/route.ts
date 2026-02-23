import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET /api/collections - List collections
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");
    const featured = searchParams.get("featured") === "true";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "12", 10), 50);

    const skip = (page - 1) * limit;

    const where: any = {};
    if (wallet) where.creatorWallet = wallet;
    if (featured) where.featured = true;

    const collections = await prisma.collection.findMany({
      where,
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit + 1,
    });

    const hasMore = collections.length > limit;
    const items = hasMore ? collections.slice(0, limit) : collections;

    // Get preview images for each collection
    const collectionsWithPreviews = await Promise.all(
      items.map(async (collection) => {
        const previewItems = await prisma.collectionItem.findMany({
          where: { collectionId: collection.id },
          include: {
            mint: {
              select: { imageUrl: true },
            },
          },
          take: 4,
          orderBy: { addedAt: "desc" },
        });

        return {
          id: collection.id,
          slug: collection.slug,
          name: collection.name,
          description: collection.description,
          imageUrl: collection.imageUrl,
          creatorWallet: collection.creatorWallet,
          featured: collection.featured,
          itemCount: collection._count.items,
          previewImages: previewItems.map((item) => item.mint.imageUrl),
          createdAt: collection.createdAt.toISOString(),
        };
      })
    );

    return NextResponse.json({
      collections: collectionsWithPreviews,
      hasMore,
      page,
    });
  } catch (err) {
    console.error("Collections GET error:", err);
    return NextResponse.json({ error: "Failed to load collections" }, { status: 500 });
  }
}

// POST /api/collections - Create collection
const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
});

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const wallet = authResult;

    // Rate limit
    const clientIp = getClientIp(req);
    const rateLimit = await checkRateLimit(`collections:create:${clientIp}`, 10, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, description, slug } = parsed.data;

    // Check if slug exists
    const existing = await prisma.collection.findUnique({
      where: { slug },
    });
    if (existing) {
      return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
    }

    const collection = await prisma.collection.create({
      data: {
        name,
        description,
        slug,
        creatorWallet: wallet,
      },
    });

    return NextResponse.json({
      success: true,
      collection: {
        id: collection.id,
        slug: collection.slug,
        name: collection.name,
        description: collection.description,
        creatorWallet: collection.creatorWallet,
        createdAt: collection.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("Collections POST error:", err);
    return NextResponse.json({ error: "Failed to create collection" }, { status: 500 });
  }
}
