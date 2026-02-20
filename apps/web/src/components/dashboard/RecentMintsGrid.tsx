"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardMint } from "@/types/dashboard";

interface RecentMintsGridProps {
  mints: DashboardMint[] | undefined;
  loading: boolean;
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.35 } },
};

function statusVariant(status: string) {
  switch (status) {
    case "confirmed":
      return "success" as const;
    case "pending":
      return "warning" as const;
    case "active":
      return "default" as const;
    default:
      return "outline" as const;
  }
}

export function RecentMintsGrid({ mints, loading }: RecentMintsGridProps) {
  if (loading) {
    return (
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4 text-foreground">Recent Mints</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <Skeleton className="aspect-square rounded-t-xl" />
              <CardContent className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!mints?.length) return null;

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-4 text-foreground">Recent Mints</h2>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
      >
        {mints.map((mint) => (
          <motion.div key={mint.id} variants={item}>
            <Link href={`/asset/${mint.mintAddress}`}>
              <Card className="overflow-hidden hover:bg-card-hover transition-colors cursor-pointer group">
                <div className="aspect-square overflow-hidden bg-background">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mint.imageUrl}
                    alt={mint.title ?? "Artwork"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <CardContent className="p-3">
                  <p className="text-sm font-medium text-foreground truncate">
                    {mint.title ?? mint.mintAddress.slice(0, 8) + "..."}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <Badge variant={statusVariant(mint.listing?.status ?? mint.status)}>
                      {mint.listing?.status ?? mint.status}
                    </Badge>
                    {mint.listing && (
                      <span className="text-xs text-muted">
                        {(Number(mint.listing.priceLamports) / 1e9).toFixed(2)} SOL
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
