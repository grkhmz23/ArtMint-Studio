import type { JazzNoirParams } from "@artmint/common";
import { mulberry32, createNoise2D } from "../prng";

interface JazzNoirInput {
  seed: number;
  palette: string[];
  params: JazzNoirParams;
}

export function renderJazzNoir(input: JazzNoirInput): string {
  const { seed, palette, params } = input;
  const rng = mulberry32(seed);
  const noise = createNoise2D(seed + 42);
  const SIZE = 1080;

  const {
    neonIntensity,
    skylineBands,
    glow,
    rainGrain,
    circleCount,
    lineCount,
    depth,
    blur,
  } = params;

  const elements: string[] = [];

  // Dark background
  const bgColor = palette[0] ?? "#0a0a0f";
  elements.push(`<rect width="${SIZE}" height="${SIZE}" fill="${bgColor}"/>`);

  // Skyline bands — horizontal layers
  for (let b = 0; b < skylineBands; b++) {
    const bandY = SIZE * (0.3 + (b / skylineBands) * 0.6);
    const bandH = SIZE * (0.02 + rng() * 0.08) * depth;
    const color = palette[(b + 1) % palette.length] ?? "#1a0a2e";
    const opacity = 0.1 + rng() * 0.3;

    // Create jagged skyline points
    const points: string[] = [];
    const segments = 20 + Math.floor(rng() * 20);
    for (let s = 0; s <= segments; s++) {
      const sx = (s / segments) * SIZE;
      const n = noise(s * 0.3 + b * 10, b * 5.7) * bandH;
      const sy = bandY + n;
      points.push(`${sx.toFixed(1)},${sy.toFixed(1)}`);
    }
    // Close the shape at bottom
    points.push(`${SIZE},${SIZE}`);
    points.push(`0,${SIZE}`);

    elements.push(
      `<polygon points="${points.join(" ")}" fill="${color}" opacity="${opacity.toFixed(3)}"/>`
    );
  }

  // Neon circles
  for (let c = 0; c < circleCount; c++) {
    const cx = rng() * SIZE;
    const cy = rng() * SIZE * 0.7 + SIZE * 0.1;
    const r = 10 + rng() * 80 * depth;
    const colorIdx = 1 + Math.floor(rng() * (palette.length - 1));
    const color = palette[colorIdx] ?? "#ff6b35";
    const opacity = neonIntensity * (0.2 + rng() * 0.6);
    const sw = 1 + rng() * 3;

    elements.push(
      `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" ` +
        `fill="none" stroke="${color}" stroke-width="${sw.toFixed(1)}" ` +
        `opacity="${opacity.toFixed(3)}"/>`
    );

    // Glow effect — larger circle behind
    if (glow > 0.1) {
      elements.push(
        `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(r * 1.5).toFixed(1)}" ` +
          `fill="none" stroke="${color}" stroke-width="${(sw * 0.5).toFixed(1)}" ` +
          `opacity="${(opacity * glow * 0.3).toFixed(3)}"/>`
      );
    }
  }

  // Neon lines — horizontal and diagonal streaks
  for (let l = 0; l < lineCount; l++) {
    const x1 = rng() * SIZE;
    const y1 = rng() * SIZE;
    const angle = rng() * Math.PI * 0.4 - Math.PI * 0.2; // mostly horizontal
    const len = 50 + rng() * 300 * depth;
    const x2 = x1 + Math.cos(angle) * len;
    const y2 = y1 + Math.sin(angle) * len;
    const colorIdx = 1 + Math.floor(rng() * (palette.length - 1));
    const color = palette[colorIdx] ?? "#00d4ff";
    const opacity = neonIntensity * (0.3 + rng() * 0.5);
    const sw = 0.5 + rng() * 2;

    elements.push(
      `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ` +
        `stroke="${color}" stroke-width="${sw.toFixed(1)}" opacity="${opacity.toFixed(3)}" ` +
        `stroke-linecap="round"/>`
    );
  }

  // Rain grain overlay
  if (rainGrain > 0.01) {
    const rainRng = mulberry32(seed + 7777);
    const rainCount = Math.floor(rainGrain * 3000);
    const rainElements: string[] = [];
    for (let r = 0; r < rainCount; r++) {
      const rx = rainRng() * SIZE;
      const ry = rainRng() * SIZE;
      const rlen = 3 + rainRng() * 15;
      const ro = rainRng() * rainGrain * 0.2;
      rainElements.push(
        `<line x1="${rx.toFixed(1)}" y1="${ry.toFixed(1)}" ` +
          `x2="${(rx + rainRng() * 2 - 1).toFixed(1)}" y2="${(ry + rlen).toFixed(1)}" ` +
          `stroke="#ffffff" stroke-width="0.5" opacity="${ro.toFixed(3)}"/>`
      );
    }
    elements.push(`<g>${rainElements.join("")}</g>`);
  }

  // SVG filter for blur/glow
  let filterDef = "";
  let filterAttr = "";
  if (blur > 0.1) {
    filterDef = `<defs><filter id="glow"><feGaussianBlur stdDeviation="${blur.toFixed(1)}" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
    filterAttr = ` filter="url(#glow)"`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
${filterDef}
<g${filterAttr}>
${elements.join("\n")}
</g>
</svg>`;

  return svg;
}
