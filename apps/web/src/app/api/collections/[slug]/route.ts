import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/collections/[slug] - Get collection details
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    const collection = await prisma.collection.findUnique({
      where: { slug },
      include: {
        items: {
          include: {
            mint: {
              select: {
                mintAddress: true,
                title: true,
                imageUrl: true,
                wallet: true,
                createdAt: true,
                inputJson: true,
              },
            },
          },
          orderBy: { addedAt: "desc" },
        },
        _count: {
          select: { items: true },
        },
      },
    });

    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    // Parse mint types
    const items = collection.items.map((item) => {
      let type: "ai" | "code" | "upload" = "ai";
      try {
        const input = JSON.parse(item.mint.inputJson);
        if (input.kind === "upload" || input.original) type = "upload";
        else if (input.mode === "svg" || input.mode === "javascript" || input.code) type = "code";
      } catch {}

      return {
        mintAddress: item.mint.mintAddress,
        title: item.mint.title,
        imageUrl: item.mint.imageUrl,
        wallet: item.mint.wallet,
        createdAt: item.mint.createdAt.toISOString(),
        type,
      };
    });

    return NextResponse.json({
      collection: {
        id: collection.id,
        slug: collection.slug,
        name: collection.name,
        description: collection.description,
        imageUrl: collection.imageUrl,
        creatorWallet: collection.creatorWallet,
        featured: collection.featured,
        itemCount: collection._count.items,
        createdAt: collection.createdAt.toISOString(),
        items,
      },
    });
  } catch (err) {
    console.error("Collection detail error:", err);
    return NextResponse.json({ error: "Failed to load collection" }, { status: 500 });
  }
}

// DELETE /api/collections/[slug] - Delete collection
export async function DELETE(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const wallet = authResult;

    const { slug } = params;

    const collection = await prisma.collection.findUnique({
      where: { slug },
    });

    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    if (collection.creatorWallet !== wallet) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    await prisma.collection.delete({
      where: { slug },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Collection delete error:", err);
    return NextResponse.json({ error: "Failed to delete collection" }, { status: 500 });
  }
}
