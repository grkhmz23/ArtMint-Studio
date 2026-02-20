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
          <Link href="/dashboard" style={{ color: "var(--text-dim)", fontSize: 14 }}>
            Dashboard
          </Link>
          <Link href="/studio" style={{ color: "var(--text-dim)", fontSize: 14 }}>
            Studio
          </Link>
          <Link href="/studio/manual" style={{ color: "var(--text-dim)", fontSize: 14 }}>
            Manual
          </Link>
          <Link href="/studio/code" style={{ color: "var(--text-dim)", fontSize: 14 }}>
            Code
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
