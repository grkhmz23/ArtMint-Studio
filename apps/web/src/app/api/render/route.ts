import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateSVG, renderPNGFromSVG } from "@artmint/render";
import { templateIds, flowFieldsParamsSchema, jazzNoirParamsSchema } from "@artmint/common";

const renderSchema = z.object({
  templateId: z.enum(templateIds),
  seed: z.number().int(),
  palette: z.array(z.string()).min(2).max(8),
  params: z.record(z.unknown()),
  format: z.enum(["svg", "png"]).optional(),
  size: z.number().int().min(100).max(3840).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const dataParam = req.nextUrl.searchParams.get("data");
    if (!dataParam) {
      return NextResponse.json({ error: "Missing data param" }, { status: 400 });
    }
    const body = JSON.parse(decodeURIComponent(dataParam));
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
      return new NextResponse(new Uint8Array(png), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Render error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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
      return new NextResponse(new Uint8Array(png), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Render error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
