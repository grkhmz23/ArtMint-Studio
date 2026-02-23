"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { useWallet } from "@solana/wallet-adapter-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import {
  Bell,
  Check,
  Trash2,
  ShoppingCart,
  Gavel,
  Heart,
  UserPlus,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  read: boolean;
  createdAt: string;
  mintAddress: string | null;
  mint?: {
    title: string | null;
    imageUrl: string;
  } | null;
}

const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
  offer_received: <ShoppingCart size={16} className="text-blue-400" />,
  offer_accepted: <ShoppingCart size={16} className="text-green-400" />,
  offer_rejected: <ShoppingCart size={16} className="text-red-400" />,
  bid_placed: <Gavel size={16} className="text-blue-400" />,
  outbid: <Gavel size={16} className="text-orange-400" />,
  auction_won: <Gavel size={16} className="text-green-400" />,
  auction_ended: <Gavel size={16} className="text-[var(--text-dim)]" />,
  follow: <UserPlus size={16} className="text-purple-400" />,
  favorite: <Heart size={16} className="text-pink-400" />,
};

export default function NotificationsPage() {
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/notifications?${filter === "unread" ? "unread=true&" : ""}limit=50`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setNotifications(data.notifications);
    } catch (err) {
      console.error("Failed to load notifications:", err);
      toast({
        title: "Error",
        description: "Failed to load notifications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (ids: string[]) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      fetchNotifications();
    } catch (err) {
      console.error("Failed to mark as read:", err);
      toast({
        title: "Error",
        description: "Failed to mark as read",
        variant: "destructive",
      });
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      fetchNotifications();
      toast({ title: "Success", description: "All notifications marked as read" });
    } catch (err) {
      console.error("Failed to mark all as read:", err);
      toast({
        title: "Error",
        description: "Failed to mark all as read",
        variant: "destructive",
      });
    }
  };

  const deleteAll = async () => {
    if (!confirm("Are you sure you want to delete all notifications?")) return;
    try {
      await fetch("/api/notifications?all=true", { method: "DELETE" });
      fetchNotifications();
      toast({ title: "Success", description: "All notifications deleted" });
    } catch (err) {
      console.error("Failed to delete notifications:", err);
      toast({
        title: "Error",
        description: "Failed to delete notifications",
        variant: "destructive",
      });
    }
  };

  const getNotificationLink = (notification: Notification) => {
    switch (notification.type) {
      case "offer_received":
      case "offer_accepted":
      case "offer_rejected":
        return "/offers";
      case "bid_placed":
      case "outbid":
      case "auction_won":
      case "auction_ended":
        return notification.data?.auctionId
          ? `/auction/${notification.data.auctionId}`
          : "/auctions";
      case "follow":
        return notification.data?.actorWallet
          ? `/profile/${notification.data.actorWallet}`
          : "/explore";
      case "favorite":
        return notification.mintAddress
          ? `/asset/${notification.mintAddress}`
          : "/explore";
      default:
        return "/";
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (!publicKey) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <div className="noise-overlay" />
        <div className="max-w-[1600px] mx-auto w-full p-6 lg:p-12 text-center">
          <Bell className="w-16 h-16 text-[var(--text-dim)] mx-auto mb-4" />
          <h1 className="font-serif text-2xl text-white mb-2">
            Connect Your Wallet
          </h1>
          <p className="font-mono text-sm text-[var(--text-dim)]">
            Connect your wallet to view notifications
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="noise-overlay" />

      <div className="max-w-[1600px] mx-auto w-full p-6 lg:p-12 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="font-serif text-4xl lg:text-5xl text-white">
              Notifications
            </h1>
            <p className="font-mono text-sm text-[var(--text-dim)]">
              {unreadCount > 0
                ? `You have ${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                : "No new notifications"}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-2 px-4 py-2 border border-[var(--border)] text-[var(--text-dim)] font-mono text-[10px] uppercase tracking-widest hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              >
                <Check size={14} />
                Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={deleteAll}
                className="flex items-center gap-2 px-4 py-2 border border-[var(--border)] text-[var(--text-dim)] font-mono text-[10px] uppercase tracking-widest hover:border-red-500 hover:text-red-500 transition-colors"
              >
                <Trash2 size={14} />
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 border-b border-[var(--border)]">
          <FilterButton
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label="All"
            count={notifications.length}
          />
          <FilterButton
            active={filter === "unread"}
            onClick={() => setFilter("unread")}
            label="Unread"
            count={unreadCount}
          />
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="border border-[var(--border)] bg-[var(--bg-card)] p-4 animate-pulse"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[var(--bg)]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[var(--bg)] w-1/4" />
                    <div className="h-3 bg-[var(--bg)] w-3/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-24 border border-[var(--border)] bg-[var(--bg-card)]">
            <Bell className="w-12 h-12 text-[var(--text-dim)] mx-auto mb-4" />
            <p className="font-mono text-sm text-[var(--text-dim)]">
              {filter === "unread"
                ? "No unread notifications"
                : "No notifications yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "flex items-start gap-4 p-4 border border-[var(--border)] bg-[var(--bg-card)] transition-colors",
                  !notification.read && "border-l-4 border-l-[var(--accent)]"
                )}
              >
                {/* Icon or Thumbnail */}
                {notification.mint?.imageUrl ? (
                  <Link
                    href={getNotificationLink(notification)}
                    className="shrink-0"
                  >
                    <img
                      src={notification.mint.imageUrl}
                      alt=""
                      className="w-14 h-14 object-cover border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
                    />
                  </Link>
                ) : (
                  <div className="w-14 h-14 border border-[var(--border)] bg-[var(--bg)] flex items-center justify-center shrink-0">
                    {NOTIFICATION_ICONS[notification.type] || (
                      <Bell size={20} className="text-[var(--text-dim)]" />
                    )}
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Link
                        href={getNotificationLink(notification)}
                        className="font-mono text-sm text-white hover:text-[var(--accent)] transition-colors"
                      >
                        {notification.title}
                      </Link>
                      <p className="font-mono text-xs text-[var(--text-dim)] mt-1">
                        {notification.message}
                      </p>
                      <p className="font-mono text-[10px] text-[var(--text-dim)] mt-2">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead([notification.id])}
                          className="p-2 text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
                          title="Mark as read"
                        >
                          <Check size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
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
      {label}
      {count > 0 && (
        <span className="px-1.5 py-0.5 bg-[var(--bg)] text-[var(--text-dim)] text-[9px]">
          {count}
        </span>
      )}
    </button>
  );
}
