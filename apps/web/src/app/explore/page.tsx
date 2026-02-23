"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/Header";
import Link from "next/link";
import { Heart, Eye, Grid3X3, LayoutList, TrendingUp, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface GalleryItem {
  mintAddress: string;
  title: string;
  imageUrl: string;
  wallet: string;
  createdAt: string;
  favoriteCount: number;
  type: "ai" | "code" | "upload";
}

type SortOption = "recent" | "popular" | "trending";
type ViewMode = "grid" | "compact";

export default function ExplorePage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>("recent");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchItems = useCallback(async (reset = false) => {
    const currentPage = reset ? 1 : page;
    try {
      const res = await fetch(`/api/explore?sort=${sort}&page=${currentPage}&limit=20`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      
      if (reset) {
        setItems(data.items);
        setPage(2);
      } else {
        setItems((prev) => [...prev, ...data.items]);
        setPage((p) => p + 1);
      }
      setHasMore(data.hasMore);
    } catch (err) {
      console.error("Failed to load gallery:", err);
    } finally {
      setLoading(false);
    }
  }, [sort, page]);

  useEffect(() => {
    fetchItems(true);
  }, [sort]);

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000 &&
        hasMore &&
        !loading
      ) {
        fetchItems();
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore, loading, fetchItems]);

  const formatAddress = (addr: string) => {
    if (addr.startsWith("pending-")) return "Pre-mint";
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="noise-overlay" />

      <div className="max-w-[1600px] mx-auto w-full p-6 lg:p-12 space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="font-serif text-4xl lg:text-5xl text-white">Explore</h1>
          <p className="font-mono text-sm text-[var(--text-dim)] max-w-2xl">
            Discover generative art from the ArtMint community. Each piece is uniquely created 
            through AI, code, or uploaded by artists and minted as NFTs on Solana.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
          {/* Sort Options */}
          <div className="flex items-center gap-2">
            <SortButton
              active={sort === "recent"}
              onClick={() => setSort("recent")}
              icon={<Clock size={14} />}
              label="Recent"
            />
            <SortButton
              active={sort === "popular"}
              onClick={() => setSort("popular")}
              icon={<Heart size={14} />}
              label="Most Liked"
            />
            <SortButton
              active={sort === "trending"}
              onClick={() => setSort("trending")}
              icon={<TrendingUp size={14} />}
              label="Trending"
            />
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2 border border-[var(--border)] p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-2 transition-colors",
                viewMode === "grid"
                  ? "bg-[var(--accent)] text-black"
                  : "text-[var(--text-dim)] hover:text-white"
              )}
            >
              <Grid3X3 size={16} />
            </button>
            <button
              onClick={() => setViewMode("compact")}
              className={cn(
                "p-2 transition-colors",
                viewMode === "compact"
                  ? "bg-[var(--accent)] text-black"
                  : "text-[var(--text-dim)] hover:text-white"
              )}
            >
              <LayoutList size={16} />
            </button>
          </div>
        </div>

        {/* Gallery Grid */}
        <div
          className={cn(
            "grid gap-4",
            viewMode === "grid"
              ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
              : "grid-cols-2 md:grid-cols-4 lg:grid-cols-6"
          )}
        >
          {items.map((item) => (
            <Link
              key={item.mintAddress}
              href={`/asset/${item.mintAddress}`}
              className="group block border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)] transition-colors"
            >
              {/* Image */}
              <div
                className={cn(
                  "relative overflow-hidden bg-[var(--bg)]",
                  viewMode === "grid" ? "aspect-square" : "aspect-[4/3]"
                )}
              >
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                {/* Type Badge */}
                <div className="absolute top-2 left-2">
                  <span
                    className={cn(
                      "px-2 py-1 text-[9px] font-mono uppercase tracking-wider",
                      item.type === "ai" && "bg-purple-500/80 text-white",
                      item.type === "code" && "bg-blue-500/80 text-white",
                      item.type === "upload" && "bg-orange-500/80 text-white"
                    )}
                  >
                    {item.type}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="p-3 space-y-2">
                <h3 className="font-serif text-sm text-white truncate group-hover:text-[var(--accent)] transition-colors">
                  {item.title || "Untitled"}
                </h3>
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">
                  <span>{formatAddress(item.wallet)}</span>
                  <span className="flex items-center gap-1">
                    <Heart size={10} />
                    {item.favoriteCount}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="border border-[var(--border)] bg-[var(--bg-card)]">
                <div className="aspect-square bg-[var(--bg)] animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-[var(--bg)] animate-pulse" />
                  <div className="h-3 bg-[var(--bg)] animate-pulse w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* End of List */}
        {!hasMore && items.length > 0 && (
          <div className="text-center py-12">
            <Sparkles className="w-8 h-8 text-[var(--accent)] mx-auto mb-4" />
            <p className="font-mono text-sm text-[var(--text-dim)]">
              You&apos;ve seen all {items.length} artworks
            </p>
          </div>
        )}

        {/* Empty State */}
        {!loading && items.length === 0 && (
          <div className="text-center py-24">
            <Eye className="w-12 h-12 text-[var(--text-dim)] mx-auto mb-4" />
            <p className="font-mono text-sm text-[var(--text-dim)]">
              No artworks found. Be the first to mint!
            </p>
            <Link
              href="/studio"
              className="inline-block mt-4 px-6 py-2 bg-[var(--accent)] text-black font-mono text-xs uppercase tracking-widest hover:bg-[var(--accent-hover)] transition-colors"
            >
              Create Art
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function SortButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 font-mono text-[11px] uppercase tracking-widest transition-colors",
        active
          ? "bg-[var(--accent)] text-black"
          : "text-[var(--text-dim)] hover:text-white border border-[var(--border)]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
