import { describe, it, expect } from "vitest";
import { variationResponseSchema } from "../validation";

describe("variationResponseSchema", () => {
  it("validates a correct flow_fields variation", () => {
    const data = {
      variations: [
        {
          templateId: "flow_fields",
          seed: 12345,
          palette: ["#ff0000", "#00ff00", "#0000ff"],
          params: {
            density: 0.5,
            lineWidth: 2,
            curvature: 3,
            grain: 0.2,
            contrast: 1,
            fieldScale: 2,
            lineCount: 200,
            stepCount: 80,
            turbulence: 0.5,
          },
          title: "Test Art",
          tags: ["abstract"],
        },
      ],
    };
    const result = variationResponseSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("validates a correct jazz_noir variation", () => {
    const data = {
      variations: [
        {
          templateId: "jazz_noir",
          seed: 99999,
          palette: ["#0a0a0f", "#ff6b35", "#00d4ff"],
          params: {
            neonIntensity: 0.8,
            skylineBands: 6,
            glow: 1.2,
            rainGrain: 0.4,
            circleCount: 15,
            lineCount: 30,
            depth: 1,
            blur: 2,
          },
        },
      ],
    };
    const result = variationResponseSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("rejects invalid templateId", () => {
    const data = {
      variations: [
        {
          templateId: "invalid_template",
          seed: 1,
          palette: ["#ff0000", "#00ff00"],
          params: {},
        },
      ],
    };
    const result = variationResponseSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects missing required params for flow_fields", () => {
    const data = {
      variations: [
        {
          templateId: "flow_fields",
          seed: 1,
          palette: ["#ff0000", "#00ff00"],
          params: {
            density: 0.5,
            // Missing many required fields
          },
        },
      ],
    };
    const result = variationResponseSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects empty variations array", () => {
    const data = { variations: [] };
    const result = variationResponseSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects invalid hex color", () => {
    const data = {
      variations: [
        {
          templateId: "flow_fields",
          seed: 1,
          palette: ["not-a-color", "#00ff00"],
          params: {
            density: 0.5,
            lineWidth: 2,
            curvature: 3,
            grain: 0.2,
            contrast: 1,
            fieldScale: 2,
            lineCount: 200,
            stepCount: 80,
            turbulence: 0.5,
          },
        },
      ],
    };
    const result = variationResponseSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
