"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWallet } from "@solana/wallet-adapter-react";
import { trackSocial } from "@/lib/analytics";

interface FavoriteButtonProps {
  mintAddress: string;
  initialCount?: number;
  showCount?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function FavoriteButton({
  mintAddress,
  initialCount = 0,
  showCount = true,
  size = "md",
  className,
}: FavoriteButtonProps) {
  const { publicKey } = useWallet();
  const [isFavorited, setIsFavorited] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  const iconSizes = {
    sm: 12,
    md: 16,
    lg: 20,
  };

  // Check if user has favorited this
  useEffect(() => {
    if (!publicKey) return;
    
    const checkFavorite = async () => {
      try {
        const res = await fetch(`/api/favorites?mintAddress=${mintAddress}`);
        if (res.ok) {
          const data = await res.json();
          setIsFavorited(data.isFavorited);
        }
      } catch (err) {
        console.error("Failed to check favorite status:", err);
      }
    };

    checkFavorite();
  }, [publicKey, mintAddress]);

  const toggleFavorite = async () => {
    if (!publicKey || loading) return;

    setLoading(true);
    try {
      if (isFavorited) {
        // Remove favorite
        const res = await fetch(`/api/favorites?mintAddress=${mintAddress}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setIsFavorited(false);
          setCount((c) => Math.max(0, c - 1));
          trackSocial("favorite_removed");
        }
      } else {
        // Add favorite
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mintAddress }),
        });
        if (res.ok) {
          setIsFavorited(true);
          setCount((c) => c + 1);
          trackSocial("favorite_added");
        }
      }
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggleFavorite}
      disabled={!publicKey || loading}
      className={cn(
        "flex items-center gap-2 transition-colors",
        !publicKey && "opacity-50 cursor-not-allowed",
        className
      )}
      title={publicKey ? (isFavorited ? "Remove from favorites" : "Add to favorites") : "Connect wallet to favorite"}
    >
      <div
        className={cn(
          "flex items-center justify-center border transition-all",
          sizeClasses[size],
          isFavorited
            ? "bg-red-500 border-red-500 text-white"
            : "border-[var(--border)] text-[var(--text-dim)] hover:text-red-500 hover:border-red-500"
        )}
      >
        <Heart
          size={iconSizes[size]}
          fill={isFavorited ? "currentColor" : "none"}
          className={loading ? "animate-pulse" : ""}
        />
      </div>
      {showCount && (
        <span className="font-mono text-xs text-[var(--text-dim)]">
          {count}
        </span>
      )}
    </button>
  );
}
