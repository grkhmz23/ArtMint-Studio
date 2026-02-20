import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateSVG, renderPNGFromSVG } from "@artmint/render";
import { templateIds } from "@artmint/common";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #ff00aa");

const renderSchema = z.object({
  templateId: z.enum(templateIds),
  seed: z.number().int().min(0).max(999999999),
  palette: z.array(hexColor).min(2).max(8),
  params: z.record(z.unknown()),
  format: z.enum(["svg", "png"]).optional(),
  size: z.number().int().min(100).max(2160).optional(),
});

/** Security headers for SVG responses — prevent script execution */
const SVG_HEADERS = {
  "Content-Type": "image/svg+xml",
  "Cache-Control": "public, max-age=31536000, immutable",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
  "X-Content-Type-Options": "nosniff",
};

const PNG_HEADERS = {
  "Content-Type": "image/png",
  "Cache-Control": "public, max-age=31536000, immutable",
  "X-Content-Type-Options": "nosniff",
};

async function applyRateLimit(req: NextRequest): Promise<NextResponse | null> {
  const clientIp = getClientIp(req);
  const rateLimit = await checkRateLimit(`render:${clientIp}`, 60, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.resetMs / 1000)) } }
    );
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const rateLimitResponse = await applyRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const dataParam = req.nextUrl.searchParams.get("data");
    if (!dataParam) {
      return NextResponse.json({ error: "Missing data param" }, { status: 400 });
    }

    if (dataParam.length > 4096) {
      return NextResponse.json({ error: "Data param too large" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = JSON.parse(decodeURIComponent(dataParam));
    } catch {
      return NextResponse.json({ error: "Invalid JSON in data param" }, { status: 400 });
    }
    const parsed = renderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { templateId, seed, palette, params, format = "svg", size = 1080 } = parsed.data;
    const svg = generateSVG({ templateId, seed, palette, params });

    if (format === "png") {
      const png = renderPNGFromSVG(svg, size);
      return new NextResponse(new Uint8Array(png), { headers: PNG_HEADERS });
    }

    return new NextResponse(svg, { headers: SVG_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Render error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = await applyRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const parsed = renderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { templateId, seed, palette, params, format = "svg", size = 1080 } = parsed.data;
    const svg = generateSVG({ templateId, seed, palette, params });

    if (format === "png") {
      const png = renderPNGFromSVG(svg, size);
      return new NextResponse(new Uint8Array(png), { headers: PNG_HEADERS });
    }

    return new NextResponse(svg, { headers: SVG_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Render error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
