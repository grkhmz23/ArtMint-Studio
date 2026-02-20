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
        <Link href="/dashboard">
          <button style={{ fontSize: 18, padding: "14px 32px" }}>
            Dashboard
          </button>
        </Link>
      </div>
      <div style={{ marginTop: 60, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24, maxWidth: 1000, margin: "60px auto 0" }}>
        <div style={{ padding: 24, background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)" }}>
          <h3 style={{ marginBottom: 8 }}>Generate</h3>
          <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
            AI creates parameterized variations from your prompt
          </p>
          <Link href="/studio" style={{ color: "var(--accent)", fontSize: 13, marginTop: 12, display: "inline-block" }}>
            Open AI Studio
          </Link>
        </div>
        <div style={{ padding: 24, background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)" }}>
          <h3 style={{ marginBottom: 8 }}>Manual</h3>
          <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
            Tweak template parameters with sliders for direct control
          </p>
          <Link href="/studio/manual" style={{ color: "var(--accent)", fontSize: 13, marginTop: 12, display: "inline-block" }}>
            Open Parameter Editor
          </Link>
        </div>
        <div style={{ padding: 24, background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)" }}>
          <h3 style={{ marginBottom: 8 }}>Code</h3>
          <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
            Write custom JavaScript drawing code with live canvas preview
          </p>
          <Link href="/studio/code" style={{ color: "var(--accent)", fontSize: 13, marginTop: 12, display: "inline-block" }}>
            Open Code Editor
          </Link>
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
