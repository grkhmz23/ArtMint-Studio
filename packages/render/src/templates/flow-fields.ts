import type { FlowFieldsParams } from "@artmint/common";
import { mulberry32, createNoise2D } from "../prng";

interface FlowFieldsInput {
  seed: number;
  palette: string[];
  params: FlowFieldsParams;
}

export function renderFlowFields(input: FlowFieldsInput): string {
  const { seed, palette, params } = input;
  const rng = mulberry32(seed);
  const noise = createNoise2D(seed + 1);
  const SIZE = 1080;

  const paths: string[] = [];
  const {
    density,
    lineWidth,
    curvature,
    grain,
    contrast,
    fieldScale,
    lineCount,
    stepCount,
    turbulence,
  } = params;

  // Generate flow lines
  for (let i = 0; i < lineCount; i++) {
    let x = rng() * SIZE;
    let y = rng() * SIZE;
    const colorIdx = Math.floor(rng() * palette.length);
    const color = palette[colorIdx] ?? palette[0]!;
    const opacity = 0.3 + rng() * 0.7 * density;
    const sw = lineWidth * (0.5 + rng() * 0.5);

    const points: string[] = [`M ${x.toFixed(2)} ${y.toFixed(2)}`];

    for (let s = 0; s < stepCount; s++) {
      const nx = x / SIZE * fieldScale;
      const ny = y / SIZE * fieldScale;
      const angle =
        noise(nx, ny) * Math.PI * 2 * curvature +
        noise(nx * 2.3 + 100, ny * 2.3 + 100) * turbulence;

      const stepSize = 2 + density * 3;
      x += Math.cos(angle) * stepSize;
      y += Math.sin(angle) * stepSize;

      // Wrap around
      if (x < 0) x += SIZE;
      if (x > SIZE) x -= SIZE;
      if (y < 0) y += SIZE;
      if (y > SIZE) y -= SIZE;

      points.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
    }

    paths.push(
      `<path d="${points.join(" ")}" fill="none" stroke="${color}" ` +
        `stroke-width="${sw.toFixed(2)}" stroke-opacity="${opacity.toFixed(3)}" ` +
        `stroke-linecap="round" stroke-linejoin="round"/>`
    );
  }

  // Optional grain overlay
  let grainDefs = "";
  let grainRect = "";
  if (grain > 0.01) {
    // Deterministic grain using small rects
    const grainPaths: string[] = [];
    const grainRng = mulberry32(seed + 999);
    const grainCount = Math.floor(grain * 8000);
    for (let g = 0; g < grainCount; g++) {
      const gx = grainRng() * SIZE;
      const gy = grainRng() * SIZE;
      const gs = 1 + grainRng() * 2;
      const go = grainRng() * grain * 0.3;
      grainPaths.push(
        `<rect x="${gx.toFixed(1)}" y="${gy.toFixed(1)}" width="${gs.toFixed(1)}" height="${gs.toFixed(1)}" fill="#fff" opacity="${go.toFixed(3)}"/>`
      );
    }
    grainRect = `<g>${grainPaths.join("")}</g>`;
  }

  // Background gradient based on contrast
  const bgColor = palette[palette.length - 1] ?? "#0a0a0a";
  const bgColor2 = palette[0] ?? "#1a1a2e";
  const bgOpacity = Math.min(1, contrast * 0.5);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
${grainDefs}
<rect width="${SIZE}" height="${SIZE}" fill="${bgColor}"/>
<rect width="${SIZE}" height="${SIZE}" fill="${bgColor2}" opacity="${bgOpacity.toFixed(2)}"/>
<g>
${paths.join("\n")}
</g>
${grainRect}
</svg>`;

  return svg;
}
