import Link from "next/link";

export default function Home() {
  return (
    <div className="container" style={{ paddingTop: 80, textAlign: "center" }}>
      <h1 style={{ fontSize: 48, fontWeight: 700, marginBottom: 16 }}>
        ArtMint Studio
      </h1>
      <p style={{ color: "var(--text-dim)", fontSize: 18, marginBottom: 40, maxWidth: 600, margin: "0 auto 40px" }}>
        AI-powered generative art director. Type a prompt, explore variations,
        mint deterministic art on Solana, and list on Exchange Art.
      </p>
      <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
        <Link href="/studio">
          <button className="btn-primary" style={{ fontSize: 18, padding: "14px 32px" }}>
            Open Studio
          </button>
        </Link>
      </div>
      <div style={{ marginTop: 60, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, maxWidth: 800, margin: "60px auto 0" }}>
        <div style={{ padding: 24, background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)" }}>
          <h3 style={{ marginBottom: 8 }}>Generate</h3>
          <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
            AI creates parameterized variations from your prompt
          </p>
        </div>
        <div style={{ padding: 24, background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)" }}>
          <h3 style={{ marginBottom: 8 }}>Mint</h3>
          <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
            Deterministic SVG art with full provenance on-chain
          </p>
        </div>
        <div style={{ padding: 24, background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)" }}>
          <h3 style={{ marginBottom: 8 }}>Sell</h3>
          <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
            List on Exchange Art marketplace with one click
          </p>
        </div>
      </div>
    </div>
  );
}
