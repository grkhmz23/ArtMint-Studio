"use client";

import Link from "next/link";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { ArrowRight, Users, UserPlus } from "lucide-react";
import { FollowButton } from "@/components/FollowButton";
import { useState } from "react";

interface MintItem {
  id: string;
  mintAddress: string;
  imageUrl: string;
  title: string | null;
  hash: string;
  createdAt: Date;
  listing: {
    status: string;
    priceLamports: string;
  } | null;
}

export function ProfileClient({
  wallet,
  mints,
  followerCount: initialFollowerCount,
  followingCount,
}: {
  wallet: string;
  mints: MintItem[];
  followerCount: number;
  followingCount: number;
}) {
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);

  const handleFollowChange = (isFollowing: boolean) => {
    setFollowerCount((prev) => (isFollowing ? prev + 1 : prev - 1));
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="noise-overlay" />

      <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-12">
        {/* Identity Banner */}
        <div className="border-b border-[var(--border)] pb-12 mb-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="flex-1">
              <h1 className="font-serif text-5xl md:text-7xl text-white italic mb-4">
                Archive.
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-mono text-xs text-[var(--accent)] uppercase tracking-widest bg-[var(--accent)]/10 px-3 py-1 inline-block border border-[var(--accent)]">
                  {wallet.slice(0, 6)}...{wallet.slice(-4)}
                </p>
                
                {/* Follow Stats */}
                <div className="flex items-center gap-4 ml-2">
                  <Link
                    href={`/profile/${wallet}/followers`}
                    className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
                  >
                    <Users size={12} />
                    <span className="text-white">{followerCount}</span>
                    <span>followers</span>
                  </Link>
                  <Link
                    href={`/profile/${wallet}/following`}
                    className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
                  >
                    <UserPlus size={12} />
                    <span className="text-white">{followingCount}</span>
                    <span>following</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Follow Button & Stats */}
            <div className="flex flex-col items-end gap-4">
              <FollowButton
                targetWallet={wallet}
                variant="outline"
                onFollowChange={handleFollowChange}
              />
              <div className="font-mono text-xs uppercase tracking-widest text-right">
                <div className="text-[var(--text-dim)] mb-1">Total Assets</div>
                <div className="text-2xl text-white">{mints.length}</div>
              </div>
            </div>
          </div>
        </div>

        {mints.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <p className="font-serif text-5xl italic text-[var(--border)] mb-6">
              Empty Archive
            </p>
            <p className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-widest mb-8">
              No inscriptions recorded. Initialize your first piece.
            </p>
            <Link href="/studio">
              <Button size="lg" className="gap-3">
                Enter Studio <ArrowRight size={14} />
              </Button>
            </Link>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-8">
              <h2 className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest">
                Portfolio Matrix
              </h2>
            </div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-px bg-[var(--border)] border border-[var(--border)]"
            >
              {mints.map((m) => (
                <motion.div
                  key={m.id}
                  variants={fadeUp}
                  className="bg-[var(--bg)] group cursor-pointer"
                >
                  <Link
                    href={`/asset/${m.mintAddress}`}
                    className="p-4 flex flex-col h-full hover:bg-[var(--bg-card)] transition-colors block no-underline"
                  >
                    <div className="aspect-square bg-black border border-[var(--border)] relative overflow-hidden mb-4 p-2">
                      <div className="absolute top-1 left-1 font-mono text-[9px] text-[var(--text-dim)] z-10">
                        [{m.mintAddress.slice(0, 6)}]
                      </div>
                      <img
                        src={m.imageUrl}
                        alt={m.title ?? "Artwork"}
                        className="w-full h-full object-cover filter grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700"
                      />
                    </div>

                    <h3 className="font-serif text-xl text-white mb-2 group-hover:text-[var(--accent)] transition-colors">
                      {m.title ?? "Untitled"}
                    </h3>

                    <div className="mt-auto pt-4 border-t border-[var(--border)] flex justify-between items-end font-mono uppercase tracking-widest">
                      {m.listing?.status === "active" ? (
                        <>
                          <span className="text-[9px] text-[var(--success)]">
                            Market
                          </span>
                          <span className="text-xs text-white">
                            {(
                              Number(m.listing.priceLamports) / 1e9
                            ).toFixed(2)}{" "}
                            SOL
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-[9px] text-[var(--text-dim)]">
                            Vault
                          </span>
                          <span className="text-xs text-[var(--text-dim)]">
                            ---
                          </span>
                        </>
                      )}
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
