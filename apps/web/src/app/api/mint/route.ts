import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateSVG, renderPNGFromSVG, buildHtmlArtifact, RENDERER_VERSION } from "@artmint/render";
import { computeHash, stableStringify, flowFieldsParamsSchema, jazzNoirParamsSchema } from "@artmint/common";
import { uploadFile } from "@/lib/storage";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/auth";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const mintRequestSchema = z.object({
  templateId: z.enum(["flow_fields", "jazz_noir"]),
  seed: z.number().int().min(0).max(999999999),
  palette: z.array(hexColor).min(2).max(8),
  params: z.record(z.unknown()),
  prompt: z.string().min(1).max(500),
  title: z.string().max(200).optional(),
}).superRefine((data, ctx) => {
  const schema = data.templateId === "flow_fields" ? flowFieldsParamsSchema : jazzNoirParamsSchema;
  const result = schema.safeParse(data.params);
  if (!result.success) {
    for (const issue of result.error.issues) {
      ctx.addIssue({
        ...issue,
        path: ["params", ...issue.path],
      });
    }
  }
});

export async function POST(req: NextRequest) {
  try {
    // Auth
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const wallet = authResult;

    // Rate limit
    const clientIp = getClientIp(req);
    const rateLimit = await checkRateLimit(`mint:${clientIp}`, 10, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.resetMs / 1000)) } }
      );
    }

    const body = await req.json();
    const parsed = mintRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { templateId, seed, palette, params, prompt, title } = parsed.data;

    // 1. Build canonical input
    const createdAt = new Date().toISOString();
    const deterministicInput = {
      rendererVersion: RENDERER_VERSION,
      templateId,
      seed,
      palette,
      params,
      prompt,
    };
    const hash = computeHash(deterministicInput);
    const canonicalInput = { ...deterministicInput, createdAt };

    // 2. Generate assets
    const svg = generateSVG({ templateId, seed, palette, params });
    const pngBuffer = renderPNGFromSVG(svg, 1080);
    const htmlArtifact = buildHtmlArtifact(canonicalInput as Parameters<typeof buildHtmlArtifact>[0]);

    // 3. Upload assets
    const fileId = `${templateId}-${seed}-${hash.slice(0, 8)}`;

    const [imageResult, animationResult] = await Promise.all([
      uploadFile(pngBuffer, `${fileId}.png`, "image/png"),
      uploadFile(htmlArtifact, `${fileId}.html`, "text/html"),
    ]);

    // 4. Build metadata JSON
    const metadata = {
      name: title ?? `ArtMint #${seed}`,
      symbol: "ARTMINT",
      description: `Deterministic generative art created from prompt: "${prompt}"`,
      image: imageResult.url,
      animation_url: animationResult.url,
      external_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/asset/pending`,
      attributes: [
        { trait_type: "Template", value: templateId },
        { trait_type: "Seed", value: seed.toString() },
        { trait_type: "Renderer Version", value: RENDERER_VERSION },
        { trait_type: "Hash", value: hash },
      ],
      properties: {
        files: [
          { uri: imageResult.url, type: "image/png" },
          { uri: animationResult.url, type: "text/html" },
        ],
        category: "html",
        canonicalInput: stableStringify(canonicalInput),
      },
    };

    const metadataJson = JSON.stringify(metadata, null, 2);
    const metadataResult = await uploadFile(metadataJson, `${fileId}-metadata.json`, "application/json");

    // 5. Save to database — wallet comes from session, not body
    const placeholderMintAddress = `pending-${hash.slice(0, 16)}`;

    await prisma.mint.create({
      data: {
        mintAddress: placeholderMintAddress,
        inputJson: stableStringify(canonicalInput),
        hash,
        imageUrl: imageResult.url,
        animationUrl: animationResult.url,
        metadataUrl: metadataResult.url,
        title: title ?? `ArtMint #${seed}`,
        wallet,
      },
    });

    return NextResponse.json({
      success: true,
      hash,
      metadataUrl: metadataResult.url,
      imageUrl: imageResult.url,
      animationUrl: animationResult.url,
      placeholderMintAddress,
      canonicalInput,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Mint error";
    console.error("Mint preparation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
