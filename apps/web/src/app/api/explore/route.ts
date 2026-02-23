import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sort = searchParams.get("sort") || "recent";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

    const skip = (page - 1) * limit;

    // Build orderBy based on sort
    let orderBy: any = { createdAt: "desc" };

    // Fetch mints
    const mints = await prisma.mint.findMany({
      where: {
        status: "confirmed",
      },
      select: {
        mintAddress: true,
        title: true,
        imageUrl: true,
        wallet: true,
        createdAt: true,
        inputJson: true,
      },
      orderBy,
      skip,
      take: limit + 1, // Get one extra to check if there are more
    });

    // Get favorite counts for these mints
    const mintAddresses = mints.map((m) => m.mintAddress);
    const favoriteCounts = await prisma.favorite.groupBy({
      by: ["mintAddress"],
      where: {
        mintAddress: { in: mintAddresses },
      },
      _count: {
        mintAddress: true,
      },
    });

    // Create a map of mintAddress -> count
    const countMap = new Map(
      favoriteCounts.map((fc) => [fc.mintAddress, fc._count.mintAddress])
    );

    // Check if there are more results
    const hasMore = mints.length > limit;
    const items = hasMore ? mints.slice(0, limit) : mints;

    // Determine type from inputJson
    let formattedItems = items.map((mint) => {
      let type: "ai" | "code" | "upload" = "ai";
      try {
        const input = JSON.parse(mint.inputJson);
        if (input.kind === "upload" || input.original) {
          type = "upload";
        } else if (input.mode === "svg" || input.mode === "javascript" || input.code) {
          type = "code";
        } else if (input.templateId || input.prompt) {
          type = "ai";
        }
      } catch {
        // Default to ai
      }

      return {
        mintAddress: mint.mintAddress,
        title: mint.title,
        imageUrl: mint.imageUrl,
        wallet: mint.wallet,
        createdAt: mint.createdAt.toISOString(),
        favoriteCount: countMap.get(mint.mintAddress) || 0,
        type,
      };
    });

    // For "popular" sort, sort by favorite count in memory
    if (sort === "popular") {
      formattedItems.sort((a, b) => b.favoriteCount - a.favoriteCount);
    }

    return NextResponse.json({
      items: formattedItems,
      hasMore,
      page,
    });
  } catch (err) {
    console.error("Explore API error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Failed to load gallery" },
      { status: 500 }
    );
  }
}
