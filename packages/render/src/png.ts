import { Resvg } from "@resvg/resvg-js";

/**
 * Render an SVG string to a PNG buffer at the specified size.
 * Uses resvg for deterministic, server-side rendering.
 */
export function renderPNGFromSVG(svg: string, size: number = 1080): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: "width",
      value: size,
    },
    font: {
      loadSystemFonts: false,
    },
  });
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}
