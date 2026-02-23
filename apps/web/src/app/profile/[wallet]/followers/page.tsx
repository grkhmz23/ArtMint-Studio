"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { FollowButton } from "@/components/FollowButton";
import { ArrowLeft, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Follower {
  wallet: string;
  createdAt: string;
}

export default function FollowersPage() {
  const { wallet } = useParams();
  const walletAddress = wallet as string;
  
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFollowers();
  }, [walletAddress]);

  const fetchFollowers = async () => {
    try {
      const res = await fetch(`/api/follow?type=followers&targetWallet=${walletAddress}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setFollowers(data.followers);
      setCount(data.count);
    } catch (err) {
      console.error("Failed to load followers:", err);
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
          <h1 className="font-serif text-4xl text-white">Followers</h1>
          <p className="font-mono text-sm text-[var(--text-dim)]">
            {count} {count === 1 ? "person" : "people"} following{" "}
            <span className="text-[var(--accent)]">{formatAddress(walletAddress)}</span>
          </p>
        </div>

        {/* Followers List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
          </div>
        ) : followers.length === 0 ? (
          <div className="text-center py-16 border border-[var(--border)] bg-[var(--bg-card)]">
            <Users className="w-12 h-12 text-[var(--text-dim)] mx-auto mb-4" />
            <p className="font-mono text-sm text-[var(--text-dim)]">
              No followers yet
            </p>
            <p className="font-mono text-xs text-[var(--text-dim)] mt-2">
              Share your profile to get discovered
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {followers.map((follower) => (
              <div
                key={follower.wallet}
                className="flex items-center justify-between p-4 border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]/50 transition-colors"
              >
                <Link
                  href={`/profile/${follower.wallet}`}
                  className="flex items-center gap-4 flex-1"
                >
                  {/* Avatar placeholder */}
                  <div className="w-12 h-12 bg-[var(--accent)] flex items-center justify-center font-mono text-sm text-black">
                    {follower.wallet.slice(0, 2).toUpperCase()}
                  </div>
                  
                  <div>
                    <p className="font-mono text-sm text-white hover:text-[var(--accent)] transition-colors">
                      {formatAddress(follower.wallet)}
                    </p>
                    <p className="font-mono text-[10px] text-[var(--text-dim)]">
                      Followed {new Date(follower.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </Link>

                <FollowButton
                  targetWallet={follower.wallet}
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
