"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Variation } from "@artmint/common";
import { ArtPreview } from "./ArtPreview";

interface Props {
  variation: Variation;
  prompt: string;
  onMoreLikeThis: () => void;
  onClose: () => void;
  wallet: string | null;
}

export function DetailPanel({
  variation,
  prompt,
  onMoreLikeThis,
  onClose,
  wallet,
}: Props) {
  const router = useRouter();
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);

  const handleMint = async () => {
    if (!wallet) {
      setMintError("Connect your wallet first");
      return;
    }

    setMinting(true);
    setMintError(null);

    try {
      // Step 1: Prepare mint (upload assets, create metadata)
      const res = await fetch("/api/mint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...variation,
          prompt,
          wallet,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Mint preparation failed");
      }

      const data = await res.json();

      // Step 2: Build and sign the on-chain transaction
      // For MVP, we redirect to the asset page which shows provenance
      // The actual on-chain mint requires wallet signing which happens client-side
      router.push(`/asset/${data.placeholderMintAddress}`);
    } catch (err) {
      setMintError(err instanceof Error ? err.message : "Mint failed");
    } finally {
      setMinting(false);
    }
  };

  return (
    <div
      style={{
        width: 380,
        borderLeft: "1px solid var(--border)",
        background: "var(--bg-card)",
        overflow: "auto",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>
          {variation.title ?? `${variation.templateId} #${variation.seed}`}
        </h3>
        <button onClick={onClose} style={{ padding: "4px 8px", fontSize: 12 }}>
          Close
        </button>
      </div>

      <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
        <ArtPreview variation={variation} size={340} />
      </div>

      {variation.description && (
        <p style={{ fontSize: 13, color: "var(--text-dim)" }}>{variation.description}</p>
      )}

      {/* Params */}
      <div>
        <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--text-dim)" }}>
          Parameters
        </h4>
        <div
          style={{
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: 10,
            fontSize: 11,
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            maxHeight: 200,
            overflow: "auto",
            lineHeight: 1.5,
          }}
        >
          {JSON.stringify(
            {
              templateId: variation.templateId,
              seed: variation.seed,
              palette: variation.palette,
              params: variation.params,
            },
            null,
            2
          )}
        </div>
      </div>

      {/* Palette */}
      <div>
        <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--text-dim)" }}>
          Palette
        </h4>
        <div style={{ display: "flex", gap: 4 }}>
          {variation.palette.map((color, i) => (
            <div
              key={i}
              style={{
                width: 32,
                height: 32,
                borderRadius: 4,
                background: color,
                border: "1px solid var(--border)",
              }}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Tags */}
      {variation.tags && variation.tags.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {variation.tags.map((tag, i) => (
            <span
              key={i}
              style={{
                padding: "2px 8px",
                fontSize: 11,
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                color: "var(--text-dim)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        <button onClick={onMoreLikeThis} style={{ width: "100%" }}>
          More like this
        </button>
        <button
          className="btn-primary"
          onClick={handleMint}
          disabled={minting || !wallet}
          style={{ width: "100%" }}
        >
          {minting ? "Preparing mint..." : !wallet ? "Connect wallet to mint" : "Mint this"}
        </button>
        {mintError && (
          <div style={{ fontSize: 12, color: "var(--danger)" }}>{mintError}</div>
        )}
      </div>
    </div>
  );
}
