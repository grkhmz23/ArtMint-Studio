"use client";

import type { Variation } from "@artmint/common";
import { ArtPreview } from "./ArtPreview";

interface Props {
  variations: Variation[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

export function VariationGrid({ variations, selectedIndex, onSelect }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 12,
      }}
    >
      {variations.map((v, i) => (
        <div
          key={`${v.templateId}-${v.seed}`}
          onClick={() => onSelect(i)}
          style={{
            cursor: "pointer",
            border: `2px solid ${selectedIndex === i ? "var(--accent)" : "var(--border)"}`,
            borderRadius: 8,
            overflow: "hidden",
            background: "var(--bg-card)",
            transition: "border-color 0.15s",
          }}
        >
          <ArtPreview variation={v} size={300} />
          <div style={{ padding: "8px 10px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>
              {v.title ?? `${v.templateId} #${v.seed}`}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
              seed: {v.seed}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
