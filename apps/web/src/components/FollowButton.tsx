"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackSocial } from "@/lib/analytics";

interface FollowButtonProps {
  targetWallet: string;
  variant?: "default" | "outline" | "compact";
  className?: string;
  onFollowChange?: (isFollowing: boolean) => void;
}

export function FollowButton({
  targetWallet,
  variant = "default",
  className,
  onFollowChange,
}: FollowButtonProps) {
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const currentWallet = publicKey?.toBase58();
  const isOwnProfile = currentWallet === targetWallet;

  const checkFollowStatus = useCallback(async () => {
    if (!currentWallet || isOwnProfile) {
      setChecking(false);
      return;
    }

    try {
      const res = await fetch(
        `/api/follow?check=true&targetWallet=${targetWallet}`
      );
      const data = await res.json();
      setIsFollowing(data.isFollowing);
    } catch (err) {
      console.error("Failed to check follow status:", err);
    } finally {
      setChecking(false);
    }
  }, [currentWallet, targetWallet, isOwnProfile]);

  useEffect(() => {
    checkFollowStatus();
  }, [checkFollowStatus]);

  const handleFollow = async () => {
    if (!currentWallet) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet to follow users",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetWallet }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to follow");
      }

      setIsFollowing(true);
      onFollowChange?.(true);
      trackSocial("follow");
      toast({
        title: "Following",
        description: "You are now following this user",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!currentWallet) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/follow?targetWallet=${targetWallet}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to unfollow");
      }

      setIsFollowing(false);
      onFollowChange?.(false);
      trackSocial("unfollow");
      toast({
        title: "Unfollowed",
        description: "You are no longer following this user",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (isOwnProfile || checking) {
    return null;
  }

  // Compact variant (icon only)
  if (variant === "compact") {
    return (
      <button
        onClick={isFollowing ? handleUnfollow : handleFollow}
        disabled={loading}
        className={cn(
          "p-2 border transition-colors",
          isFollowing
            ? "border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black"
            : "border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]",
          className
        )}
        title={isFollowing ? "Unfollow" : "Follow"}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : isFollowing ? (
          <UserCheck size={16} />
        ) : (
          <UserPlus size={16} />
        )}
      </button>
    );
  }

  // Outline variant
  if (variant === "outline") {
    return (
      <button
        onClick={isFollowing ? handleUnfollow : handleFollow}
        disabled={loading}
        className={cn(
          "flex items-center gap-2 px-4 py-2 border font-mono text-xs uppercase tracking-widest transition-colors",
          isFollowing
            ? "border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black"
            : "border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]",
          className
        )}
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : isFollowing ? (
          <>
            <UserCheck size={14} />
            Following
          </>
        ) : (
          <>
            <UserPlus size={14} />
            Follow
          </>
        )}
      </button>
    );
  }

  // Default variant (filled)
  return (
    <button
      onClick={isFollowing ? handleUnfollow : handleFollow}
      disabled={loading}
      className={cn(
        "flex items-center gap-2 px-6 py-3 font-mono text-xs uppercase tracking-widest transition-colors",
        isFollowing
          ? "border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black"
          : "bg-[var(--accent)] text-black hover:bg-[var(--accent-hover)]",
        className
      )}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : isFollowing ? (
        <>
          <UserCheck size={14} />
          Following
        </>
      ) : (
        <>
          <UserPlus size={14} />
          Follow
        </>
      )}
    </button>
  );
}
