import type { TemplateId } from "@artmint/common";

export function buildSystemPrompt(strict: boolean): string {
  const base = `You are an AI art director that generates parameters for deterministic generative art.
You MUST respond with ONLY valid JSON matching the exact schema. No markdown, no code fences, no explanation.

The JSON must be an object with a "variations" array. Each variation has:
- templateId: "flow_fields" or "jazz_noir"
- seed: a random positive integer (0-999999999)
- palette: array of 3-6 hex colors (like "#ff00aa")
- params: object with template-specific parameters (see below)
- title: short creative title (optional)
- description: one-line description (optional)
- tags: array of 1-3 tags (optional)

Template "flow_fields" params:
- density: number 0.1-1.0 (particle density)
- lineWidth: number 0.5-8 (stroke width)
- curvature: number 0-10 (field curvature)
- grain: number 0-1 (noise overlay)
- contrast: number 0.2-2 (contrast)
- fieldScale: number 0.5-5 (vector field scale)
- lineCount: integer 50-500 (number of flow lines)
- stepCount: integer 10-200 (steps per line)
- turbulence: number 0-2 (turbulence)

Template "jazz_noir" params:
- neonIntensity: number 0-1
- skylineBands: integer 2-12
- glow: number 0-2
- rainGrain: number 0-1
- circleCount: integer 3-30
- lineCount: integer 5-60
- depth: number 0.2-2
- blur: number 0-5

ALL params fields are REQUIRED. Every variation must include every field for its template.`;

  if (strict) {
    return (
      base +
      `\n\nCRITICAL: Your previous response was invalid. You MUST return ONLY a JSON object.
No other text. No markdown. No code fences. The JSON must strictly match the schema.
Double-check every field exists and every number is within range.`
    );
  }

  return base;
}

export function buildUserPrompt(
  prompt: string,
  count: number,
  templateId?: TemplateId,
  preset?: string,
  baseParams?: Record<string, unknown>
): string {
  let msg = `Generate ${count} creative variations for: "${prompt}"`;

  if (templateId) {
    msg += `\nUse template: ${templateId}`;
  } else {
    msg += `\nChoose the best template for each variation (flow_fields or jazz_noir). Mix both if appropriate.`;
  }

  if (preset) {
    msg += `\nStyle preset: ${preset}`;
  }

  if (baseParams) {
    msg += `\nBase these on these existing params (create nearby variations, varying seed, palette, and params slightly):\n${JSON.stringify(baseParams)}`;
  }

  msg += `\n\nMake each variation visually distinct. Vary seeds, palettes, and params meaningfully.
Respond with ONLY the JSON object. No other text.`;

  return msg;
}
