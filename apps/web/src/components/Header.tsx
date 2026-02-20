"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (m) => m.WalletMultiButton
    ),
  { ssr: false }
);

export function Header() {
  const { publicKey } = useWallet();

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 24px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-card)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <Link href="/" style={{ fontWeight: 700, fontSize: 18, color: "var(--text)" }}>
          ArtMint
        </Link>
        <nav style={{ display: "flex", gap: 16 }}>
          <Link href="/studio" style={{ color: "var(--text-dim)", fontSize: 14 }}>
            Studio
          </Link>
          {publicKey && (
            <Link
              href={`/profile/${publicKey.toBase58()}`}
              style={{ color: "var(--text-dim)", fontSize: 14 }}
            >
              Profile
            </Link>
          )}
        </nav>
      </div>
      <WalletMultiButton />
    </header>
  );
}
