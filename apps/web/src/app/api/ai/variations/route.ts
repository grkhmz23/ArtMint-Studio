import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateVariations } from "@artmint/ai";
import { templateIds } from "@artmint/common";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
import { requireAuth } from "@/lib/auth";
import { checkAndIncrementQuota } from "@/lib/quota";

// Max request body size: 10KB
const MAX_BODY_SIZE = 10 * 1024;

const requestSchema = z.object({
  prompt: z.string().min(1).max(500),
  preset: z.string().max(50).optional(),
  templateId: z.enum(templateIds).optional(),
  baseParams: z.record(z.unknown()).optional(),
  count: z.number().int().min(1).max(24).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Authentication
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const wallet = authResult;

    // 2. IP rate limit: 20 req/min per IP
    const clientIp = getClientIp(req);
    const ipLimit = await checkRateLimit(`ai:ip:${clientIp}`, 20, 60_000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later.", code: "rate_limited" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(ipLimit.resetMs / 1000)),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // 3. Per-user rate limit: 5 req/min per wallet
    const userLimit = await checkRateLimit(`ai:wallet:${wallet}`, 5, 60_000);
    if (!userLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment.", code: "rate_limited" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(userLimit.resetMs / 1000)),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // 4. Daily quota check + increment
    const quotaResult = await checkAndIncrementQuota(wallet, "ai_variation");
    if ("error" in quotaResult) return quotaResult.error;

    // 5. Check body size
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return NextResponse.json(
        { error: "Request body too large" },
        { status: 413 }
      );
    }

    // 6. Parse and validate
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

    return NextResponse.json({
      ...result,
      quota: quotaResult.quotaInfo,
    });
  } catch (err) {
    console.error("AI variation error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
