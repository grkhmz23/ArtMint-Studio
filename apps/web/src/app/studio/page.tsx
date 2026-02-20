"use client";

import { useState, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Header } from "@/components/Header";
import { VariationGrid } from "@/components/VariationGrid";
import { DetailPanel } from "@/components/DetailPanel";
import type { Variation } from "@artmint/common";
import { presets } from "@artmint/common";

export default function StudioPage() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [prompt, setPrompt] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("minimal");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [variations, setVariations] = useState<Variation[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateVariations = useCallback(
    async (baseParams?: Record<string, unknown>) => {
      if (!prompt.trim()) return;
      setLoading(true);
      setError(null);
      setSelectedIndex(null);

      try {
        const res = await fetch("/api/ai/variations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            prompt: prompt.trim(),
            preset: selectedPreset,
            templateId: selectedTemplate || undefined,
            baseParams,
            count: 12,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Failed to generate variations");
        }

        const data = await res.json();
        setVariations(data.variations);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate");
      } finally {
        setLoading(false);
      }
    },
    [prompt, selectedPreset, selectedTemplate]
  );

  const handleMoreLikeThis = useCallback(
    (variation: Variation) => {
      generateVariations({
        templateId: variation.templateId,
        seed: variation.seed,
        palette: variation.palette,
        params: variation.params,
      });
    },
    [generateVariations]
  );

  const selected = selectedIndex !== null ? variations[selectedIndex] ?? null : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Header />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Main content */}
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {/* Prompt input */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <input
                type="text"
                placeholder="Describe your artwork..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && generateVariations()}
                style={{ flex: 1, fontSize: 16 }}
              />
              <button
                className="btn-primary"
                onClick={() => generateVariations()}
                disabled={loading || !prompt.trim()}
                style={{ whiteSpace: "nowrap", padding: "10px 24px" }}
              >
                {loading ? "Generating..." : "Generate 12 Variations"}
              </button>
            </div>

            {/* Controls row */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 8 }}>
                {presets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPreset(p.id)}
                    style={{
                      padding: "6px 12px",
                      fontSize: 12,
                      background:
                        selectedPreset === p.id ? "var(--accent)" : "var(--bg-card)",
                      borderColor:
                        selectedPreset === p.id ? "var(--accent)" : "var(--border)",
                      color: selectedPreset === p.id ? "white" : "var(--text-dim)",
                    }}
                    title={p.description}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}
              >
                <option value="">Auto template</option>
                <option value="flow_fields">Flow Fields</option>
                <option value="jazz_noir">Jazz Noir</option>
              </select>
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: 12,
                background: "rgba(239,68,68,0.1)",
                border: "1px solid var(--danger)",
                borderRadius: 8,
                marginBottom: 16,
                color: "var(--danger)",
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          {/* Grid */}
          {variations.length > 0 && (
            <VariationGrid
              variations={variations}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
            />
          )}

          {variations.length === 0 && !loading && (
            <div
              style={{
                textAlign: "center",
                padding: 60,
                color: "var(--text-dim)",
              }}
            >
              <p style={{ fontSize: 16, marginBottom: 8 }}>
                Enter a prompt and click Generate to create variations
              </p>
              <p style={{ fontSize: 13 }}>
                Try: &quot;Cosmic ocean waves with aurora borealis&quot;
              </p>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <DetailPanel
            variation={selected}
            prompt={prompt}
            onMoreLikeThis={() => handleMoreLikeThis(selected)}
            onClose={() => setSelectedIndex(null)}
            wallet={publicKey?.toBase58() ?? null}
          />
        )}
      </div>
    </div>
  );
}
