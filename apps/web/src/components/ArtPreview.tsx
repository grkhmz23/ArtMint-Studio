"use client";

import { useMemo } from "react";
import type { Variation } from "@artmint/common";

interface Props {
  variation: Variation;
  size?: number;
}

/**
 * Client-side SVG preview using the same render logic inlined.
 * Posts to the server API for the actual render, but uses inline SVG data URI for speed.
 */
export function ArtPreview({ variation, size = 300 }: Props) {
  const svgDataUri = useMemo(() => {
    // We build SVG on the server via API, but for instant preview we use
    // a simplified approach: encode params into the src as a data URL
    // that the server render endpoint can produce
    return null; // Will use API-based rendering
  }, [variation]);

  // Use an img tag that calls our render API
  const params = encodeURIComponent(
    JSON.stringify({
      templateId: variation.templateId,
      seed: variation.seed,
      palette: variation.palette,
      params: variation.params,
      format: "svg",
    })
  );

  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "1/1",
        background: "#0a0a0f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <img
        src={`/api/render?data=${params}`}
        alt={variation.title ?? `${variation.templateId} #${variation.seed}`}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        loading="lazy"
      />
    </div>
  );
}
