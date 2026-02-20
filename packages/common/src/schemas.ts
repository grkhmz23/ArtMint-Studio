import { z } from "zod";

export const templateIds = ["flow_fields", "jazz_noir", "custom_code"] as const;
export type TemplateId = (typeof templateIds)[number];

/** Template IDs that support server-side rendering */
export const renderableTemplateIds = ["flow_fields", "jazz_noir"] as const;
export type RenderableTemplateId = (typeof renderableTemplateIds)[number];

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #ff00aa");

export const flowFieldsParamsSchema = z.object({
  density: z.number().min(0.1).max(1.0).describe("Particle/line density 0.1-1.0"),
  lineWidth: z.number().min(0.5).max(8).describe("Stroke width 0.5-8"),
  curvature: z.number().min(0).max(10).describe("Field curvature factor 0-10"),
  grain: z.number().min(0).max(1).describe("Grain/noise overlay intensity 0-1"),
  contrast: z.number().min(0.2).max(2).describe("Overall contrast 0.2-2"),
  fieldScale: z.number().min(0.5).max(5).describe("Scale of the vector field 0.5-5"),
  lineCount: z.number().int().min(50).max(500).describe("Number of flow lines 50-500"),
  stepCount: z.number().int().min(10).max(200).describe("Steps per flow line 10-200"),
  turbulence: z.number().min(0).max(2).describe("Turbulence factor 0-2"),
});
export type FlowFieldsParams = z.infer<typeof flowFieldsParamsSchema>;

export const jazzNoirParamsSchema = z.object({
  neonIntensity: z.number().min(0).max(1).describe("Neon glow intensity 0-1"),
  skylineBands: z.number().int().min(2).max(12).describe("Number of skyline bands 2-12"),
  glow: z.number().min(0).max(2).describe("Overall glow factor 0-2"),
  rainGrain: z.number().min(0).max(1).describe("Rain/grain overlay 0-1"),
  circleCount: z.number().int().min(3).max(30).describe("Number of neon circles 3-30"),
  lineCount: z.number().int().min(5).max(60).describe("Number of neon lines 5-60"),
  depth: z.number().min(0.2).max(2).describe("Depth/perspective factor 0.2-2"),
  blur: z.number().min(0).max(5).describe("Blur amount for glow effects 0-5"),
});
export type JazzNoirParams = z.infer<typeof jazzNoirParamsSchema>;

export const customCodeParamsSchema = z.object({
  code: z.string().min(1).max(100_000),
});
export type CustomCodeParams = z.infer<typeof customCodeParamsSchema>;

export const templateParamsSchema = z.discriminatedUnion("templateId", [
  z.object({ templateId: z.literal("flow_fields"), params: flowFieldsParamsSchema }),
  z.object({ templateId: z.literal("jazz_noir"), params: jazzNoirParamsSchema }),
  z.object({ templateId: z.literal("custom_code"), params: customCodeParamsSchema }),
]);

export const variationSchema = z.object({
  templateId: z.enum(templateIds),
  seed: z.number().int().min(0).max(999999999),
  palette: z.array(hexColor).min(2).max(8),
  params: z.union([flowFieldsParamsSchema, jazzNoirParamsSchema, customCodeParamsSchema]),
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
}).superRefine((data, ctx) => {
  if (data.templateId === "flow_fields") {
    const result = flowFieldsParamsSchema.safeParse(data.params);
    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Params do not match flow_fields template schema",
        path: ["params"],
      });
    }
  } else if (data.templateId === "jazz_noir") {
    const result = jazzNoirParamsSchema.safeParse(data.params);
    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Params do not match jazz_noir template schema",
        path: ["params"],
      });
    }
  } else if (data.templateId === "custom_code") {
    const result = customCodeParamsSchema.safeParse(data.params);
    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Params do not match custom_code template schema",
        path: ["params"],
      });
    }
  }
});
export type Variation = z.infer<typeof variationSchema>;

export const canonicalInputSchema = z.object({
  rendererVersion: z.string(),
  templateId: z.enum(templateIds),
  seed: z.number().int().min(0),
  palette: z.array(hexColor).min(2).max(8),
  params: z.union([flowFieldsParamsSchema, jazzNoirParamsSchema, customCodeParamsSchema]),
  prompt: z.string(),
  createdAt: z.string(),
});
export type CanonicalInput = z.infer<typeof canonicalInputSchema>;

// Default parameter values (midpoints) for manual mode
export const defaultFlowFieldsParams: FlowFieldsParams = {
  density: 0.55,
  lineWidth: 4.25,
  curvature: 5,
  grain: 0.5,
  contrast: 1.1,
  fieldScale: 2.75,
  lineCount: 275,
  stepCount: 105,
  turbulence: 1,
};

export const defaultJazzNoirParams: JazzNoirParams = {
  neonIntensity: 0.5,
  skylineBands: 7,
  glow: 1,
  rainGrain: 0.5,
  circleCount: 16,
  lineCount: 32,
  depth: 1.1,
  blur: 2.5,
};

export interface ParameterMetaEntry {
  min: number;
  max: number;
  step: number;
  label: string;
}

export const parameterMeta: Record<string, Record<string, ParameterMetaEntry>> = {
  flow_fields: {
    density: { min: 0.1, max: 1.0, step: 0.05, label: "Density" },
    lineWidth: { min: 0.5, max: 8, step: 0.5, label: "Line Width" },
    curvature: { min: 0, max: 10, step: 0.5, label: "Curvature" },
    grain: { min: 0, max: 1, step: 0.05, label: "Grain" },
    contrast: { min: 0.2, max: 2, step: 0.1, label: "Contrast" },
    fieldScale: { min: 0.5, max: 5, step: 0.25, label: "Field Scale" },
    lineCount: { min: 50, max: 500, step: 10, label: "Line Count" },
    stepCount: { min: 10, max: 200, step: 5, label: "Step Count" },
    turbulence: { min: 0, max: 2, step: 0.1, label: "Turbulence" },
  },
  jazz_noir: {
    neonIntensity: { min: 0, max: 1, step: 0.05, label: "Neon Intensity" },
    skylineBands: { min: 2, max: 12, step: 1, label: "Skyline Bands" },
    glow: { min: 0, max: 2, step: 0.1, label: "Glow" },
    rainGrain: { min: 0, max: 1, step: 0.05, label: "Rain/Grain" },
    circleCount: { min: 3, max: 30, step: 1, label: "Circle Count" },
    lineCount: { min: 5, max: 60, step: 1, label: "Line Count" },
    depth: { min: 0.2, max: 2, step: 0.1, label: "Depth" },
    blur: { min: 0, max: 5, step: 0.25, label: "Blur" },
  },
};
