import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateVariations } from "@artmint/ai";
import { templateIds } from "@artmint/common";

const requestSchema = z.object({
  prompt: z.string().min(1).max(500),
  preset: z.string().optional(),
  templateId: z.enum(templateIds).optional(),
  baseParams: z.record(z.unknown()).optional(),
  count: z.number().int().min(1).max(24).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const provider = (process.env.AI_PROVIDER ?? "anthropic") as "openai" | "anthropic";
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL ?? "claude-sonnet-4-20250514";

    if (!apiKey) {
      return NextResponse.json(
        { error: "AI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const result = await generateVariations(
      { provider, apiKey, model },
      {
        prompt: parsed.data.prompt,
        preset: parsed.data.preset,
        templateId: parsed.data.templateId,
        baseParams: parsed.data.baseParams,
        count: parsed.data.count ?? 12,
      }
    );

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("AI variation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
