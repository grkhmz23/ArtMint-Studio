"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackOffer } from "@/lib/analytics";

interface MakeOfferButtonProps {
  mintAddress: string;
  sellerWallet: string;
  onSuccess?: () => void;
}

export function MakeOfferButton({ mintAddress, sellerWallet, onSuccess }: MakeOfferButtonProps) {
  const { publicKey } = useWallet();
  const [showForm, setShowForm] = useState(false);
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey || !price) return;

    setLoading(true);
    try {
      const priceSol = parseFloat(price);
      if (isNaN(priceSol) || priceSol <= 0) {
        throw new Error("Invalid price");
      }

      const priceLamports = Math.floor(priceSol * 1e9).toString();

      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mintAddress,
          priceLamports,
          expiresInHours: 72,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to make offer");
      }

      setSuccess(true);
      trackOffer("made", priceSol);
      setPrice("");
      onSuccess?.();
      
      setTimeout(() => {
        setShowForm(false);
        setSuccess(false);
      }, 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to make offer");
    } finally {
      setLoading(false);
    }
  };

  if (!publicKey) return null;

  // Don't show if user is the seller
  if (publicKey.toBase58() === sellerWallet) return null;

  if (showForm) {
    return (
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="0.001"
            min="0.001"
            placeholder="Price in SOL"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="h-10"
            disabled={loading}
          />
          <span className="font-mono text-sm text-[var(--text-dim)] whitespace-nowrap">
            SOL
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            disabled={loading || !price}
            className="flex-1 gap-2"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : success ? (
              <>Offer Sent!</>
            ) : (
              <>
                <Send size={14} />
                Send Offer
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowForm(false)}
            disabled={loading}
          >
            <X size={14} />
          </Button>
        </div>
      </form>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={() => setShowForm(true)}
      className="w-full gap-2"
    >
      <Send size={14} />
      Make Offer
    </Button>
  );
}
