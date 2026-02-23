"use client";

import Link from "next/link";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { ArrowRight, Users, UserPlus, Globe, Twitter, MessageCircle, Settings } from "lucide-react";
import { FollowButton } from "@/components/FollowButton";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { cn } from "@/lib/utils";

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

interface UserProfile {
  wallet: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  website: string | null;
  twitter: string | null;
  discord: string | null;
  verified: boolean;
}

export function ProfileClient({
  wallet,
  mints,
  followerCount: initialFollowerCount,
  followingCount,
  profile,
}: {
  wallet: string;
  mints: MintItem[];
  followerCount: number;
  followingCount: number;
  profile: UserProfile | null;
}) {
  const { publicKey } = useWallet();
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);

  const isOwnProfile = publicKey?.toBase58() === wallet;

  const handleFollowChange = (isFollowing: boolean) => {
    setFollowerCount((prev) => (isFollowing ? prev + 1 : prev - 1));
  };

  const displayName = profile?.displayName || profile?.username || `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  const displayHandle = profile?.username ? `@${profile.username}` : `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="noise-overlay" />

      <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-12">
        {/* Profile Header */}
        <div className="border-b border-[var(--border)] pb-12 mb-12">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Avatar */}
            <div className="shrink-0">
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt=""
                  className="w-24 h-24 md:w-32 md:h-32 object-cover rounded-full border-2 border-[var(--accent)]"
                />
              ) : (
                <div className="w-24 h-24 md:w-32 md:h-32 bg-[var(--accent)] flex items-center justify-center rounded-full">
                  <span className="font-serif text-4xl md:text-5xl text-black">
                    {wallet.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="font-serif text-4xl md:text-5xl text-white">
                    {displayName}
                  </h1>
                  {profile?.verified && (
                    <span className="px-2 py-1 bg-[var(--accent)] text-black text-[10px] font-mono uppercase tracking-wider">
                      Verified
                    </span>
                  )}
                </div>
                
                <p className="font-mono text-sm text-[var(--accent)]">
                  {displayHandle}
                </p>

                {profile?.bio && (
                  <p className="font-mono text-sm text-[var(--text)] max-w-2xl leading-relaxed">
                    {profile.bio}
                  </p>
                )}

                {/* Social Links */}
                {(profile?.website || profile?.twitter || profile?.discord) && (
                  <div className="flex items-center gap-4 pt-2">
                    {profile.website && (
                      <a
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 font-mono text-xs text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
                      >
                        <Globe size={14} />
                        Website
                      </a>
                    )}
                    {profile.twitter && (
                      <a
                        href={`https://twitter.com/${profile.twitter}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 font-mono text-xs text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
                      >
                        <Twitter size={14} />
                        @{profile.twitter}
                      </a>
                    )}
                    {profile.discord && (
                      <span className="flex items-center gap-1.5 font-mono text-xs text-[var(--text-dim)]">
                        <MessageCircle size={14} />
                        {profile.discord}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Stats & Actions */}
              <div className="flex flex-wrap items-center gap-6 pt-4">
                <Link
                  href={`/profile/${wallet}/followers`}
                  className="flex items-center gap-2 font-mono text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors"
                >
                  <Users size={16} />
                  <span className="font-bold">{followerCount}</span>
                  <span className="text-[var(--text-dim)]">followers</span>
                </Link>
                <Link
                  href={`/profile/${wallet}/following`}
                  className="flex items-center gap-2 font-mono text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors"
                >
                  <UserPlus size={16} />
                  <span className="font-bold">{followingCount}</span>
                  <span className="text-[var(--text-dim)]">following</span>
                </Link>
                <span className="font-mono text-sm text-[var(--text)]">
                  <span className="font-bold">{mints.length}</span>
                  <span className="text-[var(--text-dim)]"> artworks</span>
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                {!isOwnProfile ? (
                  <FollowButton
                    targetWallet={wallet}
                    variant="default"
                    onFollowChange={handleFollowChange}
                  />
                ) : (
                  <Link href="/settings">
                    <Button variant="outline" className="gap-2">
                      <Settings size={16} />
                      Edit Profile
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Gallery */}
        {mints.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <p className="font-serif text-5xl italic text-[var(--border)] mb-6">
              Empty Archive
            </p>
            <p className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-widest mb-8">
              No inscriptions recorded. Initialize your first piece.
            </p>
            {isOwnProfile && (
              <Link href="/studio">
                <Button size="lg" className="gap-3">
                  Enter Studio <ArrowRight size={14} />
                </Button>
              </Link>
            )}
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
