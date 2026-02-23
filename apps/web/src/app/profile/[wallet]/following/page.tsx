"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { FollowButton } from "@/components/FollowButton";
import { ArrowLeft, UserPlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Following {
  wallet: string;
  createdAt: string;
}

export default function FollowingPage() {
  const { wallet } = useParams();
  const walletAddress = wallet as string;
  
  const [following, setFollowing] = useState<Following[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFollowing();
  }, [walletAddress]);

  const fetchFollowing = async () => {
    try {
      const res = await fetch(`/api/follow?type=following&targetWallet=${walletAddress}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setFollowing(data.following);
      setCount(data.count);
    } catch (err) {
      console.error("Failed to load following:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="noise-overlay" />

      <div className="max-w-[800px] mx-auto w-full p-6 lg:p-12 space-y-8">
        {/* Back Link */}
        <Link
          href={`/profile/${walletAddress}`}
          className="inline-flex items-center gap-2 font-mono text-[11px] text-[var(--text-dim)] uppercase tracking-widest hover:text-[var(--accent)] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Profile
        </Link>

        {/* Header */}
        <div className="space-y-2">
          <h1 className="font-serif text-4xl text-white">Following</h1>
          <p className="font-mono text-sm text-[var(--text-dim)]">
            <span className="text-[var(--accent)]">{formatAddress(walletAddress)}</span>
            {" "}follows {count} {count === 1 ? "person" : "people"}
          </p>
        </div>

        {/* Following List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
          </div>
        ) : following.length === 0 ? (
          <div className="text-center py-16 border border-[var(--border)] bg-[var(--bg-card)]">
            <UserPlus className="w-12 h-12 text-[var(--text-dim)] mx-auto mb-4" />
            <p className="font-mono text-sm text-[var(--text-dim)]">
              Not following anyone yet
            </p>
            <Link
              href="/explore"
              className="inline-block mt-4 px-6 py-2 bg-[var(--accent)] text-black font-mono text-xs uppercase tracking-widest hover:bg-[var(--accent-hover)] transition-colors"
            >
              Explore Artists
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {following.map((user) => (
              <div
                key={user.wallet}
                className="flex items-center justify-between p-4 border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]/50 transition-colors"
              >
                <Link
                  href={`/profile/${user.wallet}`}
                  className="flex items-center gap-4 flex-1"
                >
                  {/* Avatar placeholder */}
                  <div className="w-12 h-12 bg-[var(--accent)] flex items-center justify-center font-mono text-sm text-black">
                    {user.wallet.slice(0, 2).toUpperCase()}
                  </div>
                  
                  <div>
                    <p className="font-mono text-sm text-white hover:text-[var(--accent)] transition-colors">
                      {formatAddress(user.wallet)}
                    </p>
                    <p className="font-mono text-[10px] text-[var(--text-dim)]">
                      Following since {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </Link>

                <FollowButton
                  targetWallet={user.wallet}
                  variant="outline"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
