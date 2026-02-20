"use client";

import Link from "next/link";
import { Header } from "@/components/Header";

interface MintItem {
  id: string;
  mintAddress: string;
  imageUrl: string;
  title: string | null;
  hash: string;
  createdAt: Date;
  listing: {
    status: string;
    priceLamports: string;
  } | null;
}

export function ProfileClient({
  wallet,
  mints,
}: {
  wallet: string;
  mints: MintItem[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />
      <div className="container" style={{ padding: "32px 24px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Profile</h1>
        <p style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 32, wordBreak: "break-all" }}>
          {wallet}
        </p>

        {mints.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-dim)" }}>
            <p>No minted items yet.</p>
            <Link href="/studio">
              <button className="btn-primary" style={{ marginTop: 16 }}>
                Go to Studio
              </button>
            </Link>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            {mints.map((m) => (
              <Link key={m.id} href={`/asset/${m.mintAddress}`}>
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "var(--bg-card)",
                    transition: "border-color 0.15s",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ aspectRatio: "1/1", background: "#0a0a0f" }}>
                    <img
                      src={m.imageUrl}
                      alt={m.title ?? "Artwork"}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                      {m.title ?? "Untitled"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>
                      {m.mintAddress.slice(0, 12)}...
                    </div>
                    {m.listing && (
                      <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                        <span
                          style={{
                            color:
                              m.listing.status === "active"
                                ? "var(--success)"
                                : "var(--text-dim)",
                          }}
                        >
                          {m.listing.status}
                        </span>
                        <span>{(Number(m.listing.priceLamports) / 1e9).toFixed(2)} SOL</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
