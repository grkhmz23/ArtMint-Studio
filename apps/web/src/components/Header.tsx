"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { cn } from "@/lib/utils";
import { WalletButton } from "./WalletButton";
import { NotificationBell } from "./NotificationBell";
import { UserProfileDropdown } from "./UserProfileDropdown";

const navLinks = [
  { path: "/dashboard", label: "Index" },
  { path: "/explore", label: "Explore" },
  { path: "/collections", label: "Collections" },
  { path: "/auctions", label: "Auctions" },
  { path: "/offers", label: "Offers" },
  { path: "/activity", label: "Activity" },
  { path: "/studio", label: "AI Studio" },
  { path: "/studio/code", label: "Terminal" },
  { path: "/upload", label: "Submit" },
  { path: "/studio/manual", label: "Parameters" },
];

type EnvironmentName = "mainnet" | "devnet";

const ENVIRONMENT_CONFIG: Record<
  EnvironmentName,
  { label: string; href: string }
> = {
  mainnet: {
    label: "Mainnet",
    href: "https://www.artmintstudio.art",
  },
  devnet: {
    label: "Devnet",
    href: "https://devnet.artmintstudio.art",
  },
};

function getEnvironmentFromCluster(): EnvironmentName {
  const cluster = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "").toLowerCase();
  return cluster === "mainnet-beta" ? "mainnet" : "devnet";
}

function getEnvironmentFromHostname(hostname: string): EnvironmentName | null {
  const normalized = hostname.toLowerCase();

  if (
    normalized === "artmintstudio.art" ||
    normalized === "www.artmintstudio.art"
  ) {
    return "mainnet";
  }

  if (
    normalized === "devnet.artmintstudio.art" ||
    normalized === "localhost" ||
    normalized === "127.0.0.1"
  ) {
    return "devnet";
  }

  return null;
}

export function Header() {
  const { publicKey } = useWallet();
  const pathname = usePathname();
  const [environment, setEnvironment] = useState<EnvironmentName>(
    getEnvironmentFromCluster
  );

  useEffect(() => {
    const detectedEnvironment = getEnvironmentFromHostname(window.location.hostname);
    if (detectedEnvironment) {
      setEnvironment(detectedEnvironment);
    }
  }, []);

  const targetEnvironment = environment === "mainnet" ? "devnet" : "mainnet";

  return (
    <header className="sticky top-0 z-50 w-full bg-[var(--bg)]/90 backdrop-blur-md border-b border-[var(--border)]">
      <div className="flex h-16 items-center justify-between px-6 lg:px-12 w-full">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 group no-underline">
            <div className="w-8 h-8 border border-[var(--text)] flex items-center justify-center group-hover:bg-[var(--text)] transition-colors">
              <span className="font-serif text-lg font-bold group-hover:text-black leading-none mt-1">
                A
              </span>
            </div>
            <span className="font-serif text-xl tracking-wide hidden sm:block text-[var(--text)]">
              ArtMint.
            </span>
          </Link>

          <a
            href={ENVIRONMENT_CONFIG[targetEnvironment].href}
            className="sm:hidden border border-[var(--border)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--text-dim)] no-underline transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {ENVIRONMENT_CONFIG[targetEnvironment].label}
          </a>

          <div className="hidden sm:flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-card)]/80 p-1">
            <span className="rounded-full bg-[var(--accent)] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent-text)]">
              {ENVIRONMENT_CONFIG[environment].label}
            </span>
            <a
              href={ENVIRONMENT_CONFIG[targetEnvironment].href}
              className="rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)] no-underline transition-colors hover:text-[var(--accent)]"
            >
              {ENVIRONMENT_CONFIG[targetEnvironment].label}
            </a>
          </div>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-8 font-mono text-xs uppercase tracking-widest">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              href={link.path}
              className={cn(
                "relative py-2 transition-colors hover:text-[var(--accent)] no-underline",
                pathname === link.path ||
                  (link.path !== "/studio" &&
                    pathname.startsWith(link.path + "/"))
                  ? "text-[var(--accent)] after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-px after:bg-[var(--accent)]"
                  : "text-[var(--text-dim)]"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right Side: Notifications, User Profile, Wallet */}
        <div className="flex items-center gap-2">
          <NotificationBell />
          {publicKey ? (
            <UserProfileDropdown />
          ) : (
            <WalletButton />
          )}
        </div>
      </div>
    </header>
  );
}
