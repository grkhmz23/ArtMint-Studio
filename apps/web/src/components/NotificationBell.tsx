"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, Check, Trash2 } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
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

export function NotificationBell() {
  const { publicKey } = useWallet();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!publicKey) return;
    try {
      const res = await fetch("/api/notifications?limit=5");
      if (res.status === 401 || res.status === 403) {
        // Wallet connected but app session not authenticated yet.
        setNotifications([]);
        setUnreadCount(0);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.pagination.unreadCount);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    } catch (err) {
      console.error("Failed to mark all as read:", err);
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

  if (!publicKey) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-[var(--text-dim)] hover:text-white transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--accent)] text-black text-[10px] font-mono font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 md:w-96 border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-[var(--border)]">
            <span className="font-mono text-xs uppercase tracking-widest text-white">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[10px] font-mono text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center">
                <Bell size={24} className="text-[var(--text-dim)] mx-auto mb-2" />
                <p className="font-mono text-xs text-[var(--text-dim)]">
                  No notifications yet
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={getNotificationLink(notification)}
                  onClick={() => {
                    if (!notification.read) {
                      markAsRead([notification.id]);
                    }
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex items-start gap-3 p-3 border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg)] transition-colors",
                    !notification.read && "bg-[var(--bg)]/50"
                  )}
                >
                  {/* Thumbnail */}
                  {notification.mint?.imageUrl ? (
                    <img
                      src={notification.mint.imageUrl}
                      alt=""
                      className="w-10 h-10 object-cover border border-[var(--border)] shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center shrink-0">
                      <Bell size={14} className="text-[var(--text-dim)]" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "font-mono text-xs truncate",
                      !notification.read ? "text-white font-medium" : "text-[var(--text)]"
                    )}>
                      {notification.title}
                    </p>
                    <p className="font-mono text-[10px] text-[var(--text-dim)] line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="font-mono text-[9px] text-[var(--text-dim)] mt-1">
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!notification.read && (
                    <div className="w-2 h-2 bg-[var(--accent)] rounded-full mt-1 shrink-0" />
                  )}
                </Link>
              ))
            )}
          </div>

          {/* Footer */}
          <Link
            href="/notifications"
            onClick={() => setIsOpen(false)}
            className="block p-3 text-center font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] hover:text-white border-t border-[var(--border)] transition-colors"
          >
            View All Notifications
          </Link>
        </div>
      )}
    </div>
  );
}
