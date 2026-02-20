import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildCustomCodeArtifact, buildCustomSvgArtifact, RENDERER_VERSION } from "@artmint/render";
import { computeHash, stableStringify } from "@artmint/common";
import { uploadFile } from "@/lib/storage";

export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/auth";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const customMintSchema = z.object({
  code: z.string().min(1).max(100_000),
  mode: z.enum(["svg", "javascript"]).default("svg"),
  seed: z.number().int().min(0).max(999999999),
  palette: z.array(hexColor).min(2).max(8),
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  pngBase64: z.string().min(1).max(10_000_000),
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

    // Body size guard — reject before full parse if Content-Length is excessive
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 12_000_000) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }

    const body = await req.json();
    const parsed = customMintSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { code, mode, seed, palette, title, description, pngBase64 } = parsed.data;

    // Decode base64 PNG from client canvas capture
    const pngData = pngBase64.replace(/^data:image\/png;base64,/, "");
    const pngBuffer = Buffer.from(pngData, "base64");

    // Build canonical input
    const createdAt = new Date().toISOString();
    const deterministicInput = {
      rendererVersion: RENDERER_VERSION,
      templateId: "custom_code" as const,
      seed,
      palette,
      params: { code },
      prompt: "custom_code",
    };
    const hash = computeHash(deterministicInput);
    const canonicalInput = { ...deterministicInput, createdAt };

    // Build HTML artifact — use the right builder based on code mode
    const htmlArtifact = mode === "svg"
      ? buildCustomSvgArtifact({ code })
      : buildCustomCodeArtifact({ code, seed, palette });

    // Upload assets
    const fileId = `custom-${seed}-${hash.slice(0, 8)}`;

    const [imageResult, animationResult] = await Promise.all([
      uploadFile(pngBuffer, `${fileId}.png`, "image/png"),
      uploadFile(htmlArtifact, `${fileId}.html`, "text/html"),
    ]);

    // Build metadata JSON
    const metadata = {
      name: title ?? `ArtMint Custom #${seed}`,
      symbol: "ARTMINT",
      description: description ?? `Custom generative art created with code`,
      image: imageResult.url,
      animation_url: animationResult.url,
      external_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/asset/pending`,
      attributes: [
        { trait_type: "Template", value: "custom_code" },
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

    // Save to database
    const placeholderMintAddress = `pending-${hash.slice(0, 16)}`;

    await prisma.mint.create({
      data: {
        mintAddress: placeholderMintAddress,
        inputJson: stableStringify(canonicalInput),
        hash,
        imageUrl: imageResult.url,
        animationUrl: animationResult.url,
        metadataUrl: metadataResult.url,
        title: title ?? `ArtMint Custom #${seed}`,
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
    console.error("Custom mint error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Mint preparation failed" }, { status: 500 });
  }
}
