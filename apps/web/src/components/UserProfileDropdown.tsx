"use client";

import { useState, useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  User,
  Settings,
  LogOut,
  ChevronDown,
  Wallet,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";

interface UserProfile {
  wallet: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export function UserProfileDropdown() {
  const { publicKey, disconnect } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const wallet = publicKey?.toBase58();

  // Fetch user profile
  useEffect(() => {
    if (!wallet) return;

    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      }
    };

    fetchProfile();
  }, [wallet]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const handleCopyAddress = () => {
    if (wallet) {
      navigator.clipboard.writeText(wallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setIsOpen(false);
  };

  if (!wallet) return null;

  const displayName = profile?.displayName || profile?.username || `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  const displayHandle = profile?.username ? `@${profile.username}` : `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 border transition-colors",
          isOpen
            ? "border-[var(--accent)] bg-[var(--accent)]/10"
            : "border-[var(--border)] hover:border-[var(--accent)]/50"
        )}
      >
        {/* Avatar */}
        {profile?.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt=""
            className="w-6 h-6 object-cover rounded-full"
          />
        ) : (
          <div className="w-6 h-6 bg-[var(--accent)] flex items-center justify-center">
            <User size={14} className="text-black" />
          </div>
        )}

        {/* Name */}
        <span className="font-mono text-xs text-white hidden sm:block max-w-[120px] truncate">
          {displayName}
        </span>

        <ChevronDown
          size={14}
          className={cn(
            "text-[var(--text-dim)] transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl z-50">
          {/* Header */}
          <div className="p-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-3">
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt=""
                  className="w-10 h-10 object-cover rounded-full"
                />
              ) : (
                <div className="w-10 h-10 bg-[var(--accent)] flex items-center justify-center">
                  <User size={20} className="text-black" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm text-white truncate">
                  {displayName}
                </p>
                <p className="font-mono text-[10px] text-[var(--text-dim)] truncate">
                  {displayHandle}
                </p>
              </div>
            </div>

            {/* Wallet Address */}
            <button
              onClick={handleCopyAddress}
              className="mt-3 flex items-center gap-2 w-full px-2 py-1.5 bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--accent)]/50 transition-colors"
            >
              <Wallet size={12} className="text-[var(--text-dim)]" />
              <span className="font-mono text-[10px] text-[var(--text-dim)] flex-1 truncate">
                {wallet}
              </span>
              {copied ? (
                <Check size={12} className="text-green-500" />
              ) : (
                <Copy size={12} className="text-[var(--text-dim)]" />
              )}
            </button>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <DropdownItem
              href={`/profile/${wallet}`}
              icon={<User size={16} />}
              label="My Profile"
            />
            <DropdownItem
              href="/settings"
              icon={<Settings size={16} />}
              label="Settings"
            />
            <DropdownItem
              href={`https://explorer.solana.com/address/${wallet}`}
              icon={<ExternalLink size={16} />}
              label="View on Explorer"
              external
            />
          </div>

          {/* Disconnect */}
          <div className="p-2 border-t border-[var(--border)]">
            <button
              onClick={handleDisconnect}
              className="w-full flex items-center gap-3 px-3 py-2 font-mono text-xs text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
            >
              <LogOut size={16} />
              Disconnect Wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  href,
  icon,
  label,
  external,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  external?: boolean;
}) {
  const content = (
    <>
      <span className="text-[var(--text-dim)]">{icon}</span>
      <span className="flex-1">{label}</span>
      {external && <ExternalLink size={12} className="text-[var(--text-dim)]" />}
    </>
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 px-4 py-2 font-mono text-xs text-white hover:bg-[var(--bg)] hover:text-[var(--accent)] transition-colors no-underline"
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-2 font-mono text-xs text-white hover:bg-[var(--bg)] hover:text-[var(--accent)] transition-colors no-underline"
    >
      {content}
    </Link>
  );
}
