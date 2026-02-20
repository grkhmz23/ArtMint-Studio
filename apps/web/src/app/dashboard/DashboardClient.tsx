"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/lib/use-auth";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { fadeUp, staggerContainer } from "@/lib/animations";
import type { DashboardData, DashboardMint, ActivityItem, DraftItem } from "@/types/dashboard";

export default function DashboardClient() {
  const { publicKey } = useWallet();
  const { authenticated, signingIn, signIn } = useAuth();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      setLoading(true);
      try {
        const res = await fetch("/api/dashboard");
        const json: DashboardData = await res.json();
        setData(json);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, [authenticated]);

  const wallet = publicKey?.toBase58() ?? null;

  const stats = [
    { label: "Total Mints", value: data?.stats?.totalMints?.toString().padStart(3, "0") ?? "---" },
    { label: "Active Listings", value: data?.stats?.activeListings?.toString().padStart(3, "0") ?? "---" },
    {
      label: "Compute Left",
      value:
        data?.quota
          ? `${data.quota.remaining.toString().padStart(3, "0")}`
          : "---",
    },
    { label: "Valuation", value: data?.stats?.totalListingValue?.toFixed(1) ?? "---" },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="noise-overlay" />

      <main className="flex-1 overflow-auto">
        <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-12 space-y-12">
          {/* Header Section */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="flex flex-col md:flex-row justify-between items-end border-b border-[var(--border)] pb-8 gap-6"
          >
            <div>
              <h1 className="font-serif text-5xl md:text-7xl text-white italic mb-4">
                Index.
              </h1>
              <p className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-widest">
                {wallet
                  ? `Connected: ${wallet.slice(0, 6)}...${wallet.slice(-4)}`
                  : "Status: Disconnected"}
                {" // "}
                {new Date().toISOString().split("T")[0]}
              </p>
            </div>
            {!authenticated && wallet && (
              <Button variant="outline" onClick={signIn} disabled={signingIn}>
                {signingIn ? "Authenticating..." : "Authenticate Wallet"}
              </Button>
            )}
          </motion.div>

          {/* Architecture Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-[var(--border)] border border-[var(--border)]">
            {/* Left Column — Stats & Quick Links */}
            <div className="lg:col-span-4 bg-[var(--bg)] flex flex-col gap-px">
              <div className="bg-[var(--border)] p-px grid grid-cols-2 gap-px flex-none">
                {stats.map((s, i) => (
                  <div
                    key={i}
                    className="bg-[var(--bg)] p-6 group hover:bg-[var(--bg-card)] transition-colors"
                  >
                    <div className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest mb-4">
                      {s.label}
                    </div>
                    <div className="font-serif text-4xl text-white group-hover:text-[var(--accent)] transition-colors">
                      {loading ? "..." : s.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-[var(--bg)] p-8 flex-1 border-t border-[var(--border)]">
                <h2 className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-widest mb-8 border-b border-[var(--border)] pb-2">
                  Operations
                </h2>
                <div className="space-y-4">
                  <Link
                    href="/studio"
                    className="w-full flex items-center justify-between font-serif text-2xl text-white hover:text-[var(--accent)] transition-colors group no-underline"
                  >
                    <span>Create New</span>
                    <ArrowRight
                      strokeWidth={1}
                      className="group-hover:translate-x-2 transition-transform"
                    />
                  </Link>
                  {wallet && (
                    <Link
                      href={`/profile/${wallet}`}
                      className="w-full flex items-center justify-between font-serif text-2xl text-white hover:text-[var(--accent)] transition-colors group no-underline"
                    >
                      <span>View Collection</span>
                      <ArrowRight
                        strokeWidth={1}
                        className="group-hover:translate-x-2 transition-transform"
                      />
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column — Gallery */}
            <div className="lg:col-span-8 bg-[var(--bg)] p-8 md:p-12">
              <div className="flex justify-between items-center mb-8 border-b border-[var(--border)] pb-2">
                <h2 className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-widest">
                  Recent Acquisitions
                </h2>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="aspect-square bg-[var(--bg-card)] border border-[var(--border)] mb-4" />
                      <div className="h-5 bg-[var(--bg-card)] w-3/4 mb-2" />
                      <div className="h-3 bg-[var(--bg-card)] w-1/2" />
                    </div>
                  ))}
                </div>
              ) : data?.recentMints?.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {data.recentMints.slice(0, 4).map((mint: DashboardMint, i: number) => (
                    <motion.div
                      key={mint.id}
                      initial="hidden"
                      animate="show"
                      variants={fadeUp}
                      transition={{ delay: i * 0.1 }}
                    >
                      <Link
                        href={`/asset/${mint.mintAddress}`}
                        className="group cursor-pointer block no-underline"
                      >
                        <div className="aspect-square bg-[var(--bg-card)] border border-[var(--border)] relative overflow-hidden mb-4 p-4">
                          <div className="absolute top-2 left-2 font-mono text-[10px] text-[var(--text-dim)]">
                            #{mint.mintAddress.slice(0, 6)}
                          </div>
                          <img
                            src={mint.imageUrl}
                            alt={mint.title ?? "Artwork"}
                            className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition-all duration-700"
                          />
                        </div>
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-serif text-xl text-white group-hover:text-[var(--accent)] transition-colors">
                              {mint.title ?? mint.mintAddress.slice(0, 8) + "..."}
                            </h3>
                            <p className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest mt-1">
                              Solana //{" "}
                              {new Date(mint.createdAt).toLocaleDateString(
                                "en-US",
                                { month: "short", day: "numeric" }
                              )}
                            </p>
                          </div>
                          {mint.listing && (
                            <div className="font-mono text-xs text-[var(--text)] border border-[var(--border)] px-2 py-1">
                              {(Number(mint.listing.priceLamports) / 1e9).toFixed(2)}{" "}
                              SOL
                            </div>
                          )}
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center">
                  <p className="font-serif text-3xl italic text-[var(--border)] mb-4">
                    No works yet
                  </p>
                  <p className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-widest">
                    Create your first piece in the studio
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Drafts Section */}
          {data?.drafts && data.drafts.length > 0 && (
            <motion.div
              initial="hidden"
              animate="show"
              variants={fadeUp}
              className="border border-[var(--border)]"
            >
              <div className="p-6 border-b border-[var(--border)] flex justify-between items-center">
                <h2 className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-widest">
                  Saved Drafts
                </h2>
                <span className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest">
                  {data.drafts.length} draft{data.drafts.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-[var(--border)]">
                {data.drafts.map((draft: DraftItem) => (
                  <Link
                    key={draft.id}
                    href={
                      draft.type === "code"
                        ? `/studio/code?draft=${draft.id}`
                        : draft.type === "manual"
                        ? `/studio/manual?draft=${draft.id}`
                        : `/studio?draft=${draft.id}`
                    }
                    className="bg-[var(--bg)] p-4 hover:bg-[var(--bg-card)] transition-colors group no-underline flex flex-col"
                  >
                    <div className="aspect-square bg-[var(--bg-card)] border border-[var(--border)] mb-3 overflow-hidden flex items-center justify-center">
                      {draft.imageUrl ? (
                        <img
                          src={draft.imageUrl}
                          alt={draft.title ?? "Draft"}
                          className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition-all duration-500"
                        />
                      ) : (
                        <span className="font-serif text-2xl italic text-[var(--border)]">
                          {draft.type === "code" ? "</>" : draft.type === "ai" ? "AI" : "P"}
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[10px] text-[var(--accent)] uppercase tracking-widest mb-1">
                      {draft.type}
                    </div>
                    <div className="font-mono text-xs text-white group-hover:text-[var(--accent)] transition-colors truncate">
                      {draft.title ?? "Untitled Draft"}
                    </div>
                    <div className="font-mono text-[10px] text-[var(--text-dim)] mt-1">
                      {new Date(draft.updatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}

          {/* Activity Section */}
          {data?.recentActivity && data.recentActivity.length > 0 && (
            <motion.div
              initial="hidden"
              animate="show"
              variants={fadeUp}
              className="border border-[var(--border)]"
            >
              <div className="p-6 border-b border-[var(--border)]">
                <h2 className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-widest">
                  Activity Log
                </h2>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {data.recentActivity.map((item: ActivityItem) => (
                  <Link
                    key={item.id}
                    href={`/asset/${item.mintAddress}`}
                    className="flex items-center justify-between p-4 hover:bg-[var(--bg-card)] transition-colors no-underline"
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest w-16">
                        {item.type}
                      </span>
                      <span className="font-mono text-sm text-white">
                        {item.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`font-mono text-[10px] uppercase tracking-widest ${
                          item.status === "confirmed" || item.status === "active"
                            ? "text-[var(--success)]"
                            : "text-[var(--text-dim)]"
                        }`}
                      >
                        {item.status}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--text-dim)]">
                        {new Date(item.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
