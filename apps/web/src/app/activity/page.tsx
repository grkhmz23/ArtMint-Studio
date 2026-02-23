"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import Link from "next/link";
import { Heart, ShoppingCart, Sparkles, UserPlus, Activity, Globe, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: string;
  type: "mint" | "listing" | "sale" | "favorite" | "follow";
  wallet: string;
  targetWallet?: string;
  mint: {
    mintAddress: string;
    title: string;
    imageUrl: string;
    artist: string;
  } | null;
  metadata: any;
  createdAt: string;
}

type FilterType = "global" | "following" | "personal";

const typeConfig = {
  mint: { icon: Sparkles, color: "text-purple-400", label: "minted" },
  listing: { icon: ShoppingCart, color: "text-blue-400", label: "listed" },
  sale: { icon: ShoppingCart, color: "text-green-400", label: "sold" },
  favorite: { icon: Heart, color: "text-red-400", label: "liked" },
  follow: { icon: UserPlus, color: "text-yellow-400", label: "followed" },
};

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("global");

  useEffect(() => {
    fetchActivities();
  }, [filter]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/activity?type=${filter}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setActivities(data.activities);
    } catch (err) {
      console.error("Failed to load activity:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="noise-overlay" />

      <div className="max-w-[800px] mx-auto w-full p-6 lg:p-12 space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="font-serif text-4xl text-white">Activity</h1>
          <p className="font-mono text-sm text-[var(--text-dim)]">
            Stay updated with the latest happenings in the ArtMint community.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-[var(--border)]">
          <FilterButton
            active={filter === "global"}
            onClick={() => setFilter("global")}
            icon={<Globe size={14} />}
            label="Global"
          />
          <FilterButton
            active={filter === "following"}
            onClick={() => setFilter("following")}
            icon={<Users size={14} />}
            label="Following"
          />
          <FilterButton
            active={filter === "personal"}
            onClick={() => setFilter("personal")}
            icon={<Activity size={14} />}
            label="Your Activity"
          />
        </div>

        {/* Activity List */}
        <div className="space-y-4">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 border border-[var(--border)] bg-[var(--bg-card)]">
                <div className="w-10 h-10 bg-[var(--bg)] animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[var(--bg)] animate-pulse w-2/3" />
                  <div className="h-3 bg-[var(--bg)] animate-pulse w-1/3" />
                </div>
              </div>
            ))
          ) : activities.length === 0 ? (
            <div className="text-center py-16">
              <Activity className="w-12 h-12 text-[var(--text-dim)] mx-auto mb-4" />
              <p className="font-mono text-sm text-[var(--text-dim)]">
                No activity yet. Start creating or following artists!
              </p>
            </div>
          ) : (
            activities.map((activity) => {
              const config = typeConfig[activity.type];
              const Icon = config.icon;

              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 p-4 border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]/50 transition-colors"
                >
                  {/* Icon */}
                  <div className={cn("p-2 bg-[var(--bg)]", config.color)}>
                    <Icon size={18} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/profile/${activity.wallet}`}
                        className="font-mono text-xs text-[var(--accent)] hover:underline"
                      >
                        {formatAddress(activity.wallet)}
                      </Link>
                      <span className="font-mono text-xs text-[var(--text-dim)]">
                        {config.label}
                      </span>
                      {activity.mint && (
                        <Link
                          href={`/asset/${activity.mint.mintAddress}`}
                          className="font-serif text-sm text-white hover:text-[var(--accent)] truncate"
                        >
                          {activity.mint.title || "Untitled"}
                        </Link>
                      )}
                      {activity.type === "follow" && activity.targetWallet && (
                        <Link
                          href={`/profile/${activity.targetWallet}`}
                          className="font-mono text-xs text-[var(--accent)] hover:underline"
                        >
                          {formatAddress(activity.targetWallet)}
                        </Link>
                      )}
                    </div>
                    <p className="font-mono text-[10px] text-[var(--text-dim)] mt-1">
                      {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                    </p>
                  </div>

                  {/* Thumbnail */}
                  {activity.mint?.imageUrl && (
                    <Link href={`/asset/${activity.mint.mintAddress}`}>
                      <img
                        src={activity.mint.imageUrl}
                        alt=""
                        className="w-16 h-16 object-cover border border-[var(--border)]"
                      />
                    </Link>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-3 font-mono text-[11px] uppercase tracking-widest transition-colors border-b-2 -mb-px",
        active
          ? "text-[var(--accent)] border-[var(--accent)]"
          : "text-[var(--text-dim)] border-transparent hover:text-white"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
