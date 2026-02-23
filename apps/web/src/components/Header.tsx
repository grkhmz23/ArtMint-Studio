"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { cn } from "@/lib/utils";
import { WalletButton } from "./WalletButton";

const navLinks = [
  { path: "/dashboard", label: "Index" },
  { path: "/explore", label: "Explore" },
  { path: "/studio", label: "AI Studio" },
  { path: "/studio/code", label: "Terminal" },
  { path: "/upload", label: "Submit" },
  { path: "/studio/manual", label: "Parameters" },
];

export function Header() {
  const { publicKey } = useWallet();
  const pathname = usePathname();

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
          {publicKey && (
            <Link
              href={`/profile/${publicKey.toBase58()}`}
              className={cn(
                "relative py-2 transition-colors hover:text-[var(--accent)] no-underline",
                pathname.startsWith("/profile/")
                  ? "text-[var(--accent)] after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-px after:bg-[var(--accent)]"
                  : "text-[var(--text-dim)]"
              )}
            >
              Archive
            </Link>
          )}
        </nav>

        {/* Wallet */}
        <WalletButton />
      </div>
    </header>
  );
}
