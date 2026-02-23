"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/Header";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { TrendingUp, TrendingDown, Clock, Users, Wallet, Gavel, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackAuction } from "@/lib/analytics";

interface Auction {
  id: string;
  mintAddress: string;
  sellerWallet: string;
  type: "english" | "dutch";
  startPriceLamports: string;
  reservePriceLamports: string | null;
  minBidIncrement: string;
  highestBid: string | null;
  highestBidder: string | null;
  startTime: string;
  endTime: string;
  status: string;
  mint: {
    title: string;
    description: string;
    imageUrl: string;
    wallet: string;
  };
  bids: Array<{
    id: string;
    bidder: string;
    amountLamports: string;
    createdAt: string;
  }>;
}

export default function AuctionPage() {
  const { id } = useParams();
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const [auction, setAuction] = useState<Auction | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState("");
  const [placingBid, setPlacingBid] = useState(false);
  const [currentPriceSol, setCurrentPriceSol] = useState(0);
  const [timeLeft, setTimeLeft] = useState("");

  const fetchAuction = useCallback(async () => {
    try {
      const res = await fetch(`/api/auctions/${id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setAuction(data.auction);
      
      const currentBid = data.auction.highestBid 
        ? Number(data.auction.highestBid) / 1e9 
        : Number(data.auction.startPriceLamports) / 1e9;
      setCurrentPriceSol(currentBid);
      
      // Update time left
      const end = new Date(data.auction.endTime).getTime();
      const now = Date.now();
      const diff = end - now;
      if (diff <= 0) {
        setTimeLeft("Ended");
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft(`${hours}h ${minutes}m`);
      }
    } catch (err) {
      console.error("Failed to load auction:", err);
      toast({
        title: "Error",
        description: "Failed to load auction",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchAuction();
    const interval = setInterval(fetchAuction, 10000);
    return () => clearInterval(interval);
  }, [fetchAuction]);

  // Update Dutch auction price display in real-time
  useEffect(() => {
    if (!auction || auction.type !== "dutch") return;

    const interval = setInterval(() => {
      const end = new Date(auction.endTime).getTime();
      const start = new Date(auction.startTime).getTime();
      const now = Date.now();
      const totalDuration = end - start;
      const elapsed = now - start;
      const progress = Math.min(Math.max(elapsed / totalDuration, 0), 1);

      const startPrice = Number(auction.startPriceLamports) / 1e9;
      const reservePrice = auction.reservePriceLamports
        ? Number(auction.reservePriceLamports) / 1e9
        : startPrice * 0.1;
      
      const currentPrice = startPrice - (startPrice - reservePrice) * progress;
      setCurrentPriceSol(Math.max(currentPrice, reservePrice));
      
      // Update time left
      const diff = end - now;
      if (diff <= 0) {
        setTimeLeft("Ended");
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft(`${hours}h ${minutes}m`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [auction]);

  const handlePlaceBid = async () => {
    if (!publicKey) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet first",
      });
      return;
    }

    if (!bidAmount || parseFloat(bidAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid bid amount",
        variant: "destructive",
      });
      return;
    }

    setPlacingBid(true);
    try {
      const res = await fetch(`/api/auctions/${id}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountSol: parseFloat(bidAmount),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to place bid");
      }

      toast({
        title: auction?.type === "dutch" ? "Purchase Successful!" : "Bid Placed!",
        description: auction?.type === "dutch" 
          ? `You bought this artwork for ${bidAmount} SOL`
          : `Your bid of ${bidAmount} SOL has been placed`,
      });

      if (auction) {
        if (auction.type === "dutch") {
          trackAuction("won", "dutch", parseFloat(bidAmount));
        } else {
          trackAuction("bid", "english", parseFloat(bidAmount));
        }
      }

      setBidAmount("");
      fetchAuction();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setPlacingBid(false);
    }
  };

  const handleBuyNow = async () => {
    setBidAmount(currentPriceSol.toFixed(4));
    await handlePlaceBid();
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <div className="noise-overlay" />
        <div className="max-w-[1600px] mx-auto w-full p-6 lg:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="aspect-square bg-[var(--bg-card)] animate-pulse" />
            <div className="space-y-6">
              <div className="h-8 bg-[var(--bg-card)] animate-pulse w-2/3" />
              <div className="h-4 bg-[var(--bg-card)] animate-pulse w-1/2" />
              <div className="h-24 bg-[var(--bg-card)] animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <div className="noise-overlay" />
        <div className="max-w-[1600px] mx-auto w-full p-6 lg:p-12 text-center">
          <Gavel className="w-16 h-16 text-[var(--text-dim)] mx-auto mb-4" />
          <h1 className="font-serif text-2xl text-white mb-2">Auction Not Found</h1>
          <Link
            href="/auctions"
            className="inline-flex items-center gap-2 px-6 py-2 bg-[var(--accent)] text-black font-mono text-xs uppercase tracking-widest"
          >
            <ArrowLeft size={14} />
            Back to Auctions
          </Link>
        </div>
      </div>
    );
  }

  const minBid = auction.type === "english" && auction.highestBid
    ? (Number(auction.highestBid) / 1e9) + (Number(auction.minBidIncrement) / 1e9)
    : (Number(auction.startPriceLamports) / 1e9);

  const isSeller = publicKey?.toBase58() === auction.sellerWallet;
  const hasEnded = new Date(auction.endTime) < new Date();

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="noise-overlay" />

      <div className="max-w-[1600px] mx-auto w-full p-6 lg:p-12">
        {/* Back Link */}
        <Link
          href="/auctions"
          className="inline-flex items-center gap-2 font-mono text-[11px] text-[var(--text-dim)] uppercase tracking-widest hover:text-[var(--accent)] transition-colors mb-6"
        >
          <ArrowLeft size={14} />
          Back to Auctions
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Image */}
          <div className="border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
            <img
              src={auction.mint.imageUrl}
              alt={auction.mint.title}
              className="w-full aspect-square object-cover"
            />
          </div>

          {/* Details */}
          <div className="space-y-8">
            {/* Type Badge */}
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "px-3 py-1 text-[10px] font-mono uppercase tracking-wider flex items-center gap-2",
                  auction.type === "english"
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                )}
              >
                {auction.type === "english" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {auction.type === "english" ? "English Auction" : "Dutch Auction"}
              </span>
              <span
                className={cn(
                  "px-3 py-1 text-[10px] font-mono uppercase tracking-wider",
                  auction.status === "active"
                    ? "bg-[var(--accent)] text-black"
                    : "bg-[var(--bg)] text-[var(--text-dim)]"
                )}
              >
                {auction.status}
              </span>
            </div>

            {/* Title */}
            <div>
              <h1 className="font-serif text-4xl lg:text-5xl text-white mb-2">
                {auction.mint.title || "Untitled"}
              </h1>
              <p className="font-mono text-sm text-[var(--text-dim)]">
                by {formatAddress(auction.mint.wallet)}
              </p>
            </div>

            {/* Price Card */}
            <div className="border border-[var(--border)] bg-[var(--bg-card)] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[var(--text-dim)] uppercase">
                  {auction.type === "english" ? "Current Bid" : "Current Price"}
                </span>
                <span className="font-mono text-3xl text-[var(--accent)]">
                  {auction.type === "dutch" 
                    ? currentPriceSol.toFixed(4)
                    : auction.highestBid 
                      ? (Number(auction.highestBid) / 1e9).toFixed(4)
                      : (Number(auction.startPriceLamports) / 1e9).toFixed(4)
                  } SOL
                </span>
              </div>

              {auction.type === "dutch" && (
                <div className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs text-[var(--text-dim)]">
                    Starting: {(Number(auction.startPriceLamports) / 1e9).toFixed(2)} SOL
                  </span>
                  {auction.reservePriceLamports && (
                    <span className="font-mono text-xs text-[var(--text-dim)]">
                      Reserve: {(Number(auction.reservePriceLamports) / 1e9).toFixed(2)} SOL
                    </span>
                  )}
                </div>
              )}

              {/* Timer */}
              <div className="flex items-center gap-2 pt-4 border-t border-[var(--border)]">
                <Clock size={16} className="text-[var(--accent)]" />
                <span className="font-mono text-sm">
                  {hasEnded ? (
                    <span className="text-[var(--text-dim)]">Auction Ended</span>
                  ) : (
                    <>
                      <span className="text-white">{timeLeft}</span>
                      <span className="text-[var(--text-dim)] ml-2">
                        (ends {format(new Date(auction.endTime), "MMM d, HH:mm")})
                      </span>
                    </>
                  )}
                </span>
              </div>

              {auction.type === "english" && (
                <div className="flex items-center gap-2 text-sm text-[var(--text-dim)]">
                  <Users size={14} />
                  <span className="font-mono">{auction.bids.length} bids</span>
                  {auction.highestBidder && (
                    <span className="font-mono ml-2">
                      • Highest: {formatAddress(auction.highestBidder)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Bid/Buy Form */}
            {!hasEnded && !isSeller && auction.status === "active" && (
              <div className="space-y-4">
                {auction.type === "english" ? (
                  <>
                    <div className="flex gap-3">
                      <input
                        type="number"
                        step="0.001"
                        min={minBid}
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        placeholder={`Min bid: ${minBid.toFixed(4)} SOL`}
                        className="flex-1 px-4 py-3 bg-[var(--bg)] border border-[var(--border)] text-white font-mono text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                      />
                      <button
                        onClick={handlePlaceBid}
                        disabled={placingBid}
                        className="px-6 py-3 bg-[var(--accent)] text-black font-mono text-xs uppercase tracking-widest hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {placingBid ? "Placing..." : "Place Bid"}
                        <Gavel size={14} />
                      </button>
                    </div>
                    <p className="font-mono text-[10px] text-[var(--text-dim)]">
                      Minimum bid increment: {(Number(auction.minBidIncrement) / 1e9).toFixed(4)} SOL
                    </p>
                  </>
                ) : (
                  <button
                    onClick={handleBuyNow}
                    disabled={placingBid}
                    className="w-full py-4 bg-[var(--accent)] text-black font-mono text-sm uppercase tracking-widest hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {placingBid ? "Processing..." : (
                      <>
                        Buy Now for {currentPriceSol.toFixed(4)} SOL
                        <Wallet size={16} />
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {isSeller && auction.status === "active" && (
              <div className="p-4 border border-orange-500/30 bg-orange-500/10">
                <p className="font-mono text-xs text-orange-400">
                  You are the seller. You can cancel this auction before it receives bids.
                </p>
              </div>
            )}

            {/* Seller Info */}
            <div className="pt-6 border-t border-[var(--border)]">
              <h3 className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest mb-3">
                Seller
              </h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[var(--accent)] flex items-center justify-center font-mono text-xs uppercase text-black">
                  {auction.sellerWallet.slice(0, 2)}
                </div>
                <div>
                  <p className="font-mono text-sm text-white">
                    {formatAddress(auction.sellerWallet)}
                  </p>
                </div>
              </div>
            </div>

            {/* Bid History */}
            {auction.bids.length > 0 && (
              <div className="pt-6 border-t border-[var(--border)]">
                <h3 className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest mb-3">
                  Bid History ({auction.bids.length})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {auction.bids.map((bid, i) => (
                    <div
                      key={bid.id}
                      className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--text-dim)] font-mono text-xs">#{i + 1}</span>
                        <span className="font-mono text-xs text-white">
                          {formatAddress(bid.bidder)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-sm text-[var(--accent)]">
                          {(Number(bid.amountLamports) / 1e9).toFixed(4)} SOL
                        </span>
                        <p className="font-mono text-[9px] text-[var(--text-dim)]">
                          {formatDistanceToNow(new Date(bid.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
