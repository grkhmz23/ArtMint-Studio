"use client";

import { useState } from "react";
import { X, TrendingUp, TrendingDown, Gavel } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { trackAuction } from "@/lib/analytics";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mintAddress: string;
  title: string;
  imageUrl: string;
  onSuccess: () => void;
}

export function CreateAuctionModal({ isOpen, onClose, mintAddress, title, imageUrl, onSuccess }: Props) {
  const { toast } = useToast();
  const [auctionType, setAuctionType] = useState<"english" | "dutch">("english");
  const [startPrice, setStartPrice] = useState("");
  const [reservePrice, setReservePrice] = useState("");
  const [minBidIncrement, setMinBidIncrement] = useState("0.1");
  const [duration, setDuration] = useState("24");
  const [creating, setCreating] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!startPrice || parseFloat(startPrice) <= 0) {
      toast({ title: "Error", description: "Please enter a valid start price", variant: "destructive" });
      return;
    }

    if (auctionType === "dutch" && reservePrice && parseFloat(reservePrice) >= parseFloat(startPrice)) {
      toast({ title: "Error", description: "Reserve price must be lower than start price for Dutch auction", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/auctions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mintAddress,
          type: auctionType,
          startPriceSol: parseFloat(startPrice),
          reservePriceSol: reservePrice ? parseFloat(reservePrice) : undefined,
          minBidIncrementSol: auctionType === "english" ? parseFloat(minBidIncrement) : undefined,
          durationHours: parseInt(duration),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create auction");
      }

      toast({
        title: "Auction Created!",
        description: `Your ${auctionType} auction is now live`,
      });
      trackAuction("created", auctionType, parseFloat(startPrice));
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg border border-[var(--border)] bg-[var(--bg-card)] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <Gavel size={20} className="text-[var(--accent)]" />
            <h2 className="font-serif text-xl text-white">Create Auction</h2>
          </div>
          <button onClick={onClose} className="text-[var(--text-dim)] hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Preview */}
        <div className="p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-4">
            <img src={imageUrl} alt={title} className="w-16 h-16 object-cover border border-[var(--border)]" />
            <div>
              <p className="font-mono text-sm text-white truncate">{title}</p>
              <p className="font-mono text-[10px] text-[var(--text-dim)]">{mintAddress.slice(0, 8)}...</p>
            </div>
          </div>
        </div>

        {/* Auction Type */}
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setAuctionType("english")}
              className={cn(
                "p-4 border text-left transition-all",
                auctionType === "english"
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)] hover:border-[var(--text-dim)]"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={18} className={auctionType === "english" ? "text-[var(--accent)]" : "text-[var(--text-dim)]"} />
                <span className="font-mono text-xs uppercase tracking-wider text-white">English</span>
              </div>
              <p className="font-mono text-[10px] text-[var(--text-dim)]">Bid up, highest wins</p>
            </button>
            <button
              onClick={() => setAuctionType("dutch")}
              className={cn(
                "p-4 border text-left transition-all",
                auctionType === "dutch"
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)] hover:border-[var(--text-dim)]"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown size={18} className={auctionType === "dutch" ? "text-[var(--accent)]" : "text-[var(--text-dim)]"} />
                <span className="font-mono text-xs uppercase tracking-wider text-white">Dutch</span>
              </div>
              <p className="font-mono text-[10px] text-[var(--text-dim)]">Price drops until bought</p>
            </button>
          </div>

          {/* Price Fields */}
          <div className="space-y-3">
            <div>
              <label className="block font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-2">
                {auctionType === "english" ? "Starting Price" : "Starting Price (High)"} (SOL)
              </label>
              <input
                type="number"
                step="0.01"
                value={startPrice}
                onChange={(e) => setStartPrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] text-white font-mono text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-2">
                {auctionType === "english" ? "Reserve Price (optional)" : "Reserve/Floor Price"} (SOL)
              </label>
              <input
                type="number"
                step="0.01"
                value={reservePrice}
                onChange={(e) => setReservePrice(e.target.value)}
                placeholder={auctionType === "dutch" ? "Minimum price" : "Hidden minimum"}
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] text-white font-mono text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            {auctionType === "english" && (
              <div>
                <label className="block font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-2">
                  Minimum Bid Increment (SOL)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={minBidIncrement}
                  onChange={(e) => setMinBidIncrement(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] text-white font-mono text-sm focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            )}

            <div>
              <label className="block font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-2">
                Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] text-white font-mono text-sm focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="24">24 hours</option>
                <option value="48">48 hours</option>
                <option value="72">72 hours</option>
                <option value="168">7 days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-[var(--border)] text-white font-mono text-xs uppercase tracking-widest hover:border-[var(--accent)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex-1 px-4 py-2 bg-[var(--accent)] text-black font-mono text-xs uppercase tracking-widest hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Auction"}
          </button>
        </div>
      </div>
    </div>
  );
}
