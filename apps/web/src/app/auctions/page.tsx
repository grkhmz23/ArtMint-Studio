"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/Header";
import Link from "next/link";
import { Clock, TrendingUp, TrendingDown, Gavel, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Auction {
  id: string;
  mintAddress: string;
  sellerWallet: string;
  startPriceSol: number;
  reservePriceSol: number | null;
  type: "english" | "dutch";
  endTime: string;
  status: string;
  highestBidSol: number | null;
  highestBidder: string | null;
  bidCount: number;
  mint: {
    mintAddress: string;
    title: string;
    imageUrl: string;
    wallet: string;
  };
}

export default function AuctionsPage() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "english" | "dutch">("all");

  const fetchAuctions = useCallback(async () => {
    try {
      const typeParam = filter !== "all" ? `&type=${filter}` : "";
      const res = await fetch(`/api/auctions?status=active${typeParam}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setAuctions(data.auctions);
    } catch (err) {
      console.error("Failed to load auctions:", err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchAuctions();
    const interval = setInterval(fetchAuctions, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchAuctions]);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="noise-overlay" />

      <div className="max-w-[1600px] mx-auto w-full p-6 lg:p-12 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2">
            <h1 className="font-serif text-4xl lg:text-5xl text-white">Auctions</h1>
            <p className="font-mono text-sm text-[var(--text-dim)] max-w-xl">
              Bid on unique artworks or buy instantly at descending prices.
              English auctions go to highest bidder, Dutch auctions drop until someone buys.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 border-b border-[var(--border)]">
          <FilterButton
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label="All Auctions"
          />
          <FilterButton
            active={filter === "english"}
            onClick={() => setFilter("english")}
            icon={<TrendingUp size={14} />}
            label="English (Bid Up)"
          />
          <FilterButton
            active={filter === "dutch"}
            onClick={() => setFilter("dutch")}
            icon={<TrendingDown size={14} />}
            label="Dutch (Price Down)"
          />
        </div>

        {/* Auctions Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border border-[var(--border)] bg-[var(--bg-card)]">
                <div className="aspect-square bg-[var(--bg)] animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-[var(--bg)] animate-pulse w-2/3" />
                  <div className="h-3 bg-[var(--bg)] animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : auctions.length === 0 ? (
          <div className="text-center py-24 border border-[var(--border)] bg-[var(--bg-card)]">
            <Gavel className="w-12 h-12 text-[var(--text-dim)] mx-auto mb-4" />
            <p className="font-mono text-sm text-[var(--text-dim)]">
              No active auctions right now.
            </p>
            <Link
              href="/explore"
              className="inline-block mt-4 px-6 py-2 bg-[var(--accent)] text-black font-mono text-xs uppercase tracking-widest hover:bg-[var(--accent-hover)] transition-colors"
            >
              Explore Artworks
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {auctions.map((auction) => (
              <AuctionCard key={auction.id} auction={auction} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AuctionCard({ auction }: { auction: Auction }) {
  const [currentPrice, setCurrentPrice] = useState(
    auction.highestBidSol || auction.startPriceSol
  );

  // Update Dutch auction price in real-time
  useEffect(() => {
    if (auction.type !== "dutch") return;

    const interval = setInterval(() => {
      const end = new Date(auction.endTime).getTime();
      const start = end - 24 * 60 * 60 * 1000; // Approximate start time
      const now = Date.now();
      const totalDuration = end - start;
      const elapsed = now - start;
      const progress = Math.min(Math.max(elapsed / totalDuration, 0), 1);

      const endPrice = auction.reservePriceSol || auction.startPriceSol * 0.1;
      const price = auction.startPriceSol - (auction.startPriceSol - endPrice) * progress;
      setCurrentPrice(Math.max(price, endPrice));
    }, 1000);

    return () => clearInterval(interval);
  }, [auction]);

  return (
    <Link
      href={`/auction/${auction.id}`}
      className="group block border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)] transition-colors"
    >
      {/* Image */}
      <div className="aspect-square bg-[var(--bg)] relative overflow-hidden">
        <img
          src={auction.mint.imageUrl}
          alt={auction.mint.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {/* Type Badge */}
        <div className="absolute top-3 left-3">
          <span
            className={cn(
              "px-2 py-1 text-[9px] font-mono uppercase tracking-wider",
              auction.type === "english"
                ? "bg-green-500/80 text-white"
                : "bg-orange-500/80 text-white"
            )}
          >
            {auction.type === "english" ? "English" : "Dutch"}
          </span>
        </div>
        {/* Countdown */}
        <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/80 text-white text-[10px] font-mono flex items-center gap-1">
          <Clock size={10} />
          {formatDistanceToNow(new Date(auction.endTime), { addSuffix: false })} left
        </div>
      </div>

      {/* Info */}
      <div className="p-4 space-y-3">
        <h3 className="font-serif text-lg text-white truncate group-hover:text-[var(--accent)] transition-colors">
          {auction.mint.title || "Untitled"}
        </h3>

        {/* Price Info */}
        <div className="space-y-1">
          {auction.type === "english" ? (
            <>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-[var(--text-dim)] uppercase">
                  Current Bid
                </span>
                <span className="font-mono text-lg text-[var(--accent)]">
                  {(auction.highestBidSol || auction.startPriceSol).toFixed(4)} SOL
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-[var(--text-dim)] font-mono">
                <Users size={10} />
                {auction.bidCount} bids
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-[var(--text-dim)] uppercase">
                  Current Price
                </span>
                <span className="font-mono text-lg text-[var(--accent)]">
                  {currentPrice.toFixed(4)} SOL
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-[var(--text-dim)] font-mono">
                <span>Start: {auction.startPriceSol.toFixed(2)}</span>
                {auction.reservePriceSol && (
                  <span>Reserve: {auction.reservePriceSol.toFixed(2)}</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Seller */}
        <div className="pt-2 border-t border-[var(--border)]">
          <span className="font-mono text-[10px] text-[var(--text-dim)]">
            Seller: {auction.sellerWallet.slice(0, 4)}...{auction.sellerWallet.slice(-4)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function FilterButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-3 font-mono text-[11px] uppercase tracking-widest transition-colors border-b-2 -mb-px",
        active
          ? "text-[var(--accent)] border-[var(--accent)]"
          : "text-[var(--text-dim)] border-transparent hover:text-white"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
