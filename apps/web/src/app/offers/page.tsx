"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import Link from "next/link";
import { ArrowLeft, Check, X, Clock, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { trackOffer } from "@/lib/analytics";

interface Offer {
  id: string;
  mintAddress: string;
  buyerWallet: string;
  sellerWallet: string;
  priceLamports: string;
  priceSol: number;
  status: string;
  expiresAt: string;
  createdAt: string;
  mint: {
    mintAddress: string;
    title: string;
    imageUrl: string;
    wallet: string;
  };
}

export default function OffersPage() {
  const { publicKey } = useWallet();
  const [receivedOffers, setReceivedOffers] = useState<Offer[]>([]);
  const [sentOffers, setSentOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"received" | "sent">("received");
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (publicKey) fetchOffers();
  }, [publicKey]);

  const fetchOffers = async () => {
    if (!publicKey) return;
    
    setLoading(true);
    try {
      // Fetch received offers
      const receivedRes = await fetch(`/api/offers?sellerWallet=${publicKey.toBase58()}`);
      if (receivedRes.ok) {
        const data = await receivedRes.json();
        setReceivedOffers(data.offers);
      }

      // Fetch sent offers
      const sentRes = await fetch(`/api/offers?buyerWallet=${publicKey.toBase58()}`);
      if (sentRes.ok) {
        const data = await sentRes.json();
        setSentOffers(data.offers);
      }
    } catch (err) {
      console.error("Failed to load offers:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (offerId: string) => {
    setProcessing(offerId);
    try {
      const res = await fetch(`/api/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to accept");
      }

      // Track offer acceptance
      const offer = receivedOffers.find(o => o.id === offerId);
      if (offer) {
        trackOffer("accepted", offer.priceSol);
      }

      fetchOffers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to accept offer");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (offerId: string) => {
    if (!confirm("Reject this offer?")) return;
    
    setProcessing(offerId);
    try {
      const res = await fetch(`/api/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to reject");
      }

      // Track offer rejection
      const offer = receivedOffers.find(o => o.id === offerId);
      if (offer) {
        trackOffer("rejected", offer.priceSol);
      }

      fetchOffers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reject offer");
    } finally {
      setProcessing(null);
    }
  };

  const handleCancel = async (offerId: string) => {
    if (!confirm("Cancel this offer?")) return;
    
    setProcessing(offerId);
    try {
      const res = await fetch(`/api/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to cancel");
      }

      fetchOffers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel offer");
    } finally {
      setProcessing(null);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  const offers = activeTab === "received" ? receivedOffers : sentOffers;

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="noise-overlay" />

      <div className="max-w-[1200px] mx-auto w-full p-6 lg:p-12 space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 font-mono text-xs text-[var(--text-dim)] hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Dashboard
          </Link>
          <h1 className="font-serif text-4xl text-white">Offers</h1>
          <p className="font-mono text-sm text-[var(--text-dim)]">
            Manage offers on your NFTs and offers you&apos;ve made to others.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4 border-b border-[var(--border)]">
          <button
            onClick={() => setActiveTab("received")}
            className={cn(
              "px-4 py-3 font-mono text-[11px] uppercase tracking-widest transition-colors border-b-2 -mb-px",
              activeTab === "received"
                ? "text-[var(--accent)] border-[var(--accent)]"
                : "text-[var(--text-dim)] border-transparent hover:text-white"
            )}
          >
            Received ({receivedOffers.length})
          </button>
          <button
            onClick={() => setActiveTab("sent")}
            className={cn(
              "px-4 py-3 font-mono text-[11px] uppercase tracking-widest transition-colors border-b-2 -mb-px",
              activeTab === "sent"
                ? "text-[var(--accent)] border-[var(--accent)]"
                : "text-[var(--text-dim)] border-transparent hover:text-white"
            )}
          >
            Sent ({sentOffers.length})
          </button>
        </div>

        {/* Offers List */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 border border-[var(--border)] bg-[var(--bg-card)]">
                <div className="w-20 h-20 bg-[var(--bg)] animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[var(--bg)] animate-pulse w-1/3" />
                  <div className="h-3 bg-[var(--bg)] animate-pulse w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : offers.length === 0 ? (
          <div className="text-center py-24 border border-[var(--border)] bg-[var(--bg-card)]">
            <Send className="w-12 h-12 text-[var(--text-dim)] mx-auto mb-4" />
            <p className="font-mono text-sm text-[var(--text-dim)]">
              No {activeTab} offers yet.
            </p>
            {activeTab === "sent" && (
              <Link
                href="/explore"
                className="inline-block mt-4 px-6 py-2 bg-[var(--accent)] text-black font-mono text-xs uppercase tracking-widest hover:bg-[var(--accent-hover)] transition-colors"
              >
                Explore Artworks
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className="flex flex-col md:flex-row md:items-center gap-4 p-4 border border-[var(--border)] bg-[var(--bg-card)]"
              >
                {/* NFT Image */}
                <Link href={`/asset/${offer.mintAddress}`}>
                  <img
                    src={offer.mint.imageUrl}
                    alt={offer.mint.title}
                    className="w-20 h-20 object-cover border border-[var(--border)]"
                  />
                </Link>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/asset/${offer.mintAddress}`}
                    className="font-serif text-lg text-white hover:text-[var(--accent)] transition-colors"
                  >
                    {offer.mint.title || "Untitled"}
                  </Link>
                  <div className="flex items-center gap-4 mt-1 font-mono text-[11px] text-[var(--text-dim)]">
                    <span className="text-[var(--accent)] text-base">
                      {offer.priceSol.toFixed(4)} SOL
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      Expires {formatDistanceToNow(new Date(offer.expiresAt), { addSuffix: true })}
                    </span>
                    {activeTab === "received" ? (
                      <span>From: {formatAddress(offer.buyerWallet)}</span>
                    ) : (
                      <span>To: {formatAddress(offer.sellerWallet)}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {activeTab === "received" ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleAccept(offer.id)}
                        disabled={processing === offer.id}
                        className="gap-2"
                      >
                        {processing === offer.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Check size={14} />
                        )}
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(offer.id)}
                        disabled={processing === offer.id}
                        className="gap-2 text-[var(--danger)] border-[var(--danger)] hover:bg-[var(--danger)] hover:text-white"
                      >
                        <X size={14} />
                        Reject
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCancel(offer.id)}
                      disabled={processing === offer.id}
                    >
                      {processing === offer.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        "Cancel"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
