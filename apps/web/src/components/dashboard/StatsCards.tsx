"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Palette, ShoppingBag, Sparkles, Wallet } from "lucide-react";
import type { DashboardStats } from "@/types/dashboard";

interface StatsCardsProps {
  stats: DashboardStats | undefined;
  quotaRemaining: number | undefined;
  quotaLimit: number | undefined;
  loading: boolean;
}

const cards = [
  { key: "totalMints", label: "Total Mints", icon: Palette, color: "text-accent" },
  { key: "activeListings", label: "Active Listings", icon: ShoppingBag, color: "text-success" },
  { key: "quota", label: "AI Generations Left", icon: Sparkles, color: "text-warning" },
  { key: "wallet", label: "Listing Value (SOL)", icon: Wallet, color: "text-accent" },
] as const;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function StatsCards({ stats, quotaRemaining, quotaLimit, loading }: StatsCardsProps) {
  function getValue(key: string): string {
    if (!stats) return "—";
    switch (key) {
      case "totalMints":
        return stats.totalMints.toString();
      case "activeListings":
        return stats.activeListings.toString();
      case "quota":
        return quotaRemaining !== undefined && quotaLimit !== undefined
          ? `${quotaRemaining}/${quotaLimit}`
          : "—";
      case "wallet":
        return stats.totalListingValue.toFixed(2);
      default:
        return "—";
    }
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
    >
      {cards.map((c) => (
        <motion.div key={c.key} variants={item}>
          <Card className="hover:bg-card-hover transition-colors">
            <CardContent className="p-5">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <c.icon className={`h-4 w-4 ${c.color}`} />
                    <span className="text-xs text-muted">{c.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{getValue(c.key)}</p>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}
