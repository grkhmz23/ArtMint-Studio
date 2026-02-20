"use client";

import { useState, useMemo, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Header } from "@/components/Header";
import type { CanonicalInput } from "@artmint/common";

interface MintData {
  id: string;
  mintAddress: string;
  inputJson: string;
  hash: string;
  imageUrl: string;
  animationUrl: string;
  metadataUrl: string;
  title: string | null;
  wallet: string;
  createdAt: Date;
  listing: {
    id: string;
    mintAddress: string;
    priceLamports: string;
    status: string;
    txSignature: string | null;
    saleStateKey: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}

export function AssetClient({ mint }: { mint: MintData }) {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [listPrice, setListPrice] = useState("");
  const [listing, setListing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [exporting, setExporting] = useState(false);

  const canonicalInput = useMemo(() => {
    try {
      return JSON.parse(mint.inputJson) as CanonicalInput;
    } catch {
      return null;
    }
  }, [mint.inputJson]);

  const handleCopyParams = async () => {
    await navigator.clipboard.writeText(mint.inputJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /**
   * Client-side 4K export: fetch the SVG from the render API at 1080px,
   * then render it to a canvas at 3840px and export as PNG.
   * This avoids needing the server to render at 3840.
   */
  const handleExport4K = useCallback(async () => {
    if (!canonicalInput) return;
    setExporting(true);

    try {
      const params = encodeURIComponent(
        JSON.stringify({
          templateId: canonicalInput.templateId,
          seed: canonicalInput.seed,
          palette: canonicalInput.palette,
          params: canonicalInput.params,
          format: "svg",
        })
      );

      const res = await fetch(`/api/render?data=${params}`);
      if (!res.ok) throw new Error("Failed to fetch SVG");
      const svgText = await res.text();

      const SIZE = 3840;
      const blob = new Blob([svgText], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setExporting(false);
          return;
        }
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        URL.revokeObjectURL(url);

        canvas.toBlob(
          (pngBlob) => {
            if (!pngBlob) {
              setExporting(false);
              return;
            }
            const a = document.createElement("a");
            a.href = URL.createObjectURL(pngBlob);
            a.download = `artmint-${canonicalInput.templateId}-${canonicalInput.seed}-4K.png`;
            a.click();
            URL.revokeObjectURL(a.href);
            setExporting(false);
          },
          "image/png"
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        setExporting(false);
      };

      img.src = url;
    } catch {
      setExporting(false);
    }
  }, [canonicalInput]);

  const handleRerender4K = () => {
    // Open the HTML artifact in a new tab — it has built-in 4K export too
    window.open(mint.animationUrl, "_blank");
  };

  const handleListBuyNow = async () => {
    if (!publicKey || !listPrice) return;

    const priceLamports = Math.floor(parseFloat(listPrice) * 1e9);
    if (isNaN(priceLamports) || priceLamports <= 0) {
      setListError("Enter a valid price in SOL");
      return;
    }

    setListing(true);
    setListError(null);

    try {
      // Wallet comes from session cookie — no need to send in body
      const res = await fetch("/api/listing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mintAddress: mint.mintAddress,
          priceLamports: priceLamports.toString(),
          status: "active",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Listing failed");
      }

      window.location.reload();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Listing failed");
    } finally {
      setListing(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />
      <div className="container" style={{ padding: "32px 24px", display: "flex", gap: 32, flexWrap: "wrap" }}>
        {/* Left: Artwork */}
        <div style={{ flex: "1 1 500px" }}>
          <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
            <button
              onClick={() => setShowLive(false)}
              style={{
                background: !showLive ? "var(--accent)" : "var(--bg-card)",
                borderColor: !showLive ? "var(--accent)" : "var(--border)",
                color: !showLive ? "white" : "var(--text-dim)",
              }}
            >
              PNG Preview
            </button>
            <button
              onClick={() => setShowLive(true)}
              style={{
                background: showLive ? "var(--accent)" : "var(--bg-card)",
                borderColor: showLive ? "var(--accent)" : "var(--border)",
                color: showLive ? "white" : "var(--text-dim)",
              }}
            >
              Live Render
            </button>
          </div>

          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
              background: "#0a0a0f",
              aspectRatio: "1/1",
              maxWidth: 600,
            }}
          >
            {showLive ? (
              <iframe
                src={mint.animationUrl}
                sandbox="allow-scripts"
                style={{ width: "100%", height: "100%", border: "none" }}
                title="Live render"
              />
            ) : (
              <img
                src={mint.imageUrl}
                alt={mint.title ?? "Artwork"}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            )}
          </div>
        </div>

        {/* Right: Info + Provenance */}
        <div style={{ flex: "1 1 350px", maxWidth: 500 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
            {mint.title ?? `ArtMint #${canonicalInput?.seed ?? ""}`}
          </h1>
          <p style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 24 }}>
            Mint: {mint.mintAddress}
          </p>

          {/* Provenance Panel */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 20,
              marginBottom: 24,
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
              Provenance
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ProvenanceRow label="Prompt" value={canonicalInput?.prompt ?? "—"} />
              <ProvenanceRow label="Template" value={canonicalInput?.templateId ?? "—"} />
              <ProvenanceRow label="Seed" value={String(canonicalInput?.seed ?? "—")} />
              <ProvenanceRow label="Renderer" value={canonicalInput?.rendererVersion ?? "—"} />
              <ProvenanceRow label="Hash" value={mint.hash} mono />
              <div>
                <span style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>
                  Palette
                </span>
                <div style={{ display: "flex", gap: 4 }}>
                  {(canonicalInput?.palette ?? []).map((c, i) => (
                    <div
                      key={i}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 4,
                        background: c,
                        border: "1px solid var(--border)",
                      }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={handleCopyParams} style={{ fontSize: 12, flex: 1 }}>
                {copied ? "Copied!" : "Copy params"}
              </button>
              <button
                onClick={handleExport4K}
                disabled={exporting}
                style={{ fontSize: 12, flex: 1 }}
              >
                {exporting ? "Exporting..." : "Export 4K PNG"}
              </button>
              <button onClick={handleRerender4K} style={{ fontSize: 12, flex: 1 }}>
                Open Artifact
              </button>
            </div>
          </div>

          {/* Listing UI */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
              Listing
            </h3>

            {mint.listing ? (
              <div>
                <div style={{ fontSize: 14, marginBottom: 8 }}>
                  Status:{" "}
                  <span
                    style={{
                      color:
                        mint.listing.status === "active"
                          ? "var(--success)"
                          : "var(--text-dim)",
                      fontWeight: 600,
                    }}
                  >
                    {mint.listing.status}
                  </span>
                </div>
                <div style={{ fontSize: 14 }}>
                  Price: {(Number(mint.listing.priceLamports) / 1e9).toFixed(4)} SOL
                </div>
                {mint.listing.txSignature && (
                  <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8 }}>
                    TX: {mint.listing.txSignature}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Price in SOL"
                    value={listPrice}
                    onChange={(e) => setListPrice(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn-success"
                    onClick={handleListBuyNow}
                    disabled={listing || !publicKey || !listPrice}
                  >
                    {listing ? "Listing..." : "List Buy Now"}
                  </button>
                </div>
                {listError && (
                  <div style={{ fontSize: 12, color: "var(--danger)" }}>{listError}</div>
                )}
                {!publicKey && (
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    Connect wallet to list
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProvenanceRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <span style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 2 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          fontFamily: mono ? "monospace" : "inherit",
          wordBreak: "break-all",
        }}
      >
        {value}
      </span>
    </div>
  );
}
