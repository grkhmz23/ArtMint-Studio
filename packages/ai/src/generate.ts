import type { Variation, TemplateId } from "@artmint/common";
import { variationResponseSchema } from "./validation";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";

export interface VariationRequest {
  prompt: string;
  preset?: string;
  templateId?: TemplateId;
  baseParams?: Record<string, unknown>;
  count?: number;
}

export interface VariationResponse {
  variations: Variation[];
}

interface AIConfig {
  provider: "openai" | "anthropic";
  apiKey: string;
  model: string;
}

async function callAI(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  if (config.provider === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${err}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    const textBlock = data.content.find((b) => b.type === "text");
    if (!textBlock?.text) {
      throw new Error("No text in Anthropic response");
    }
    return textBlock.text;
  }

  // OpenAI-compatible
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 8192,
      temperature: 0.9,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${err}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? "";
}

function extractJSON(text: string): string {
  // Try to find JSON in the response (handle markdown code fences)
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }
  // Try to find { ... } directly
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    return text.slice(braceStart, braceEnd + 1);
  }
  return text.trim();
}

export async function generateVariations(
  config: AIConfig,
  request: VariationRequest
): Promise<VariationResponse> {
  const count = request.count ?? 12;
  const userPrompt = buildUserPrompt(
    request.prompt,
    count,
    request.templateId,
    request.preset,
    request.baseParams
  );

  // First attempt
  let systemPrompt = buildSystemPrompt(false);
  let rawText = await callAI(config, systemPrompt, userPrompt);
  let jsonStr = extractJSON(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Retry with strict prompt
    systemPrompt = buildSystemPrompt(true);
    rawText = await callAI(config, systemPrompt, userPrompt);
    jsonStr = extractJSON(rawText);
    parsed = JSON.parse(jsonStr);
  }

  const result = variationResponseSchema.safeParse(parsed);
  if (result.success) {
    return result.data;
  }

  // One retry with strict prompt
  systemPrompt = buildSystemPrompt(true);
  rawText = await callAI(config, systemPrompt, userPrompt);
  jsonStr = extractJSON(rawText);

  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`AI returned invalid JSON after retry: ${(e as Error).message}`);
  }

  const retryResult = variationResponseSchema.safeParse(parsed);
  if (retryResult.success) {
    return retryResult.data;
  }

  throw new Error(
    `AI output failed validation after retry: ${JSON.stringify(retryResult.error.issues.slice(0, 3))}`
  );
}
