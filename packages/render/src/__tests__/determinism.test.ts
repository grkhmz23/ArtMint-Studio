import { describe, it, expect } from "vitest";
import { generateSVG } from "../generate";
import { mulberry32 } from "../prng";

describe("renderer determinism", () => {
  const flowFieldsInput = {
    templateId: "flow_fields" as const,
    seed: 42,
    palette: ["#1a1a2e", "#16213e", "#0f3460", "#e94560", "#f5f5f5"],
    params: {
      density: 0.6,
      lineWidth: 2.5,
      curvature: 4,
      grain: 0.3,
      contrast: 1.2,
      fieldScale: 2.5,
      lineCount: 100,
      stepCount: 50,
      turbulence: 0.8,
    },
  };

  const jazzNoirInput = {
    templateId: "jazz_noir" as const,
    seed: 777,
    palette: ["#0a0a0f", "#1a0a2e", "#ff6b35", "#00d4ff", "#ff0066"],
    params: {
      neonIntensity: 0.7,
      skylineBands: 5,
      glow: 1.0,
      rainGrain: 0.3,
      circleCount: 10,
      lineCount: 20,
      depth: 1.0,
      blur: 1.5,
    },
  };

  it("produces identical SVG for flow_fields with same input", () => {
    const svg1 = generateSVG(flowFieldsInput);
    const svg2 = generateSVG(flowFieldsInput);
    expect(svg1).toBe(svg2);
  });

  it("produces identical SVG for jazz_noir with same input", () => {
    const svg1 = generateSVG(jazzNoirInput);
    const svg2 = generateSVG(jazzNoirInput);
    expect(svg1).toBe(svg2);
  });

  it("produces different SVG for different seeds", () => {
    const svg1 = generateSVG(flowFieldsInput);
    const svg2 = generateSVG({ ...flowFieldsInput, seed: 43 });
    expect(svg1).not.toBe(svg2);
  });

  it("generates valid SVG with correct viewBox", () => {
    const svg = generateSVG(flowFieldsInput);
    expect(svg).toContain('viewBox="0 0 1080 1080"');
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });
});

describe("PRNG determinism", () => {
  it("produces same sequence for same seed", () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);

    const seq1 = Array.from({ length: 100 }, () => rng1());
    const seq2 = Array.from({ length: 100 }, () => rng2());

    expect(seq1).toEqual(seq2);
  });

  it("produces different sequence for different seed", () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(43);

    const v1 = rng1();
    const v2 = rng2();

    expect(v1).not.toBe(v2);
  });

  it("produces values in [0, 1)", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
