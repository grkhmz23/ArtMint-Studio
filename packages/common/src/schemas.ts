import { z } from "zod";

export const templateIds = ["flow_fields", "jazz_noir"] as const;
export type TemplateId = (typeof templateIds)[number];

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

export const templateParamsSchema = z.discriminatedUnion("templateId", [
  z.object({ templateId: z.literal("flow_fields"), params: flowFieldsParamsSchema }),
  z.object({ templateId: z.literal("jazz_noir"), params: jazzNoirParamsSchema }),
]);

export const variationSchema = z.object({
  templateId: z.enum(templateIds),
  seed: z.number().int().min(0),
  palette: z.array(hexColor).min(2).max(8),
  params: z.union([flowFieldsParamsSchema, jazzNoirParamsSchema]),
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type Variation = z.infer<typeof variationSchema>;

export const canonicalInputSchema = z.object({
  rendererVersion: z.string(),
  templateId: z.enum(templateIds),
  seed: z.number().int().min(0),
  palette: z.array(hexColor).min(2).max(8),
  params: z.union([flowFieldsParamsSchema, jazzNoirParamsSchema]),
  prompt: z.string(),
  createdAt: z.string(),
});
export type CanonicalInput = z.infer<typeof canonicalInputSchema>;
