import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateSVG, renderPNGFromSVG, buildHtmlArtifact, RENDERER_VERSION } from "@artmint/render";
import { canonicalInputSchema, computeHash, stableStringify } from "@artmint/common";
import { uploadFile } from "@/lib/storage";
import { prisma } from "@/lib/db";

const mintRequestSchema = z.object({
  templateId: z.enum(["flow_fields", "jazz_noir"]),
  seed: z.number().int(),
  palette: z.array(z.string()).min(2).max(8),
  params: z.record(z.unknown()),
  prompt: z.string(),
  title: z.string().optional(),
  wallet: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = mintRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { templateId, seed, palette, params, prompt, title, wallet } = parsed.data;

    // 1. Build canonical input
    const canonicalInput = {
      rendererVersion: RENDERER_VERSION,
      templateId,
      seed,
      palette,
      params,
      prompt,
      createdAt: new Date().toISOString(),
    };

    // 2. Compute deterministic hash
    const hash = computeHash(canonicalInput);

    // 3. Generate assets
    const svg = generateSVG({ templateId, seed, palette, params });
    const pngBuffer = renderPNGFromSVG(svg, 1080);
    const htmlArtifact = buildHtmlArtifact(canonicalInput as Parameters<typeof buildHtmlArtifact>[0]);

    // 4. Upload assets
    const fileId = `${templateId}-${seed}-${hash.slice(0, 8)}`;

    const [imageResult, animationResult] = await Promise.all([
      uploadFile(pngBuffer, `${fileId}.png`, "image/png"),
      uploadFile(htmlArtifact, `${fileId}.html`, "text/html"),
    ]);

    // 5. Build metadata JSON
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
    const metadataResult = await uploadFile(
      metadataJson,
      `${fileId}-metadata.json`,
      "application/json"
    );

    // 6. Save to database (mint address will be updated after on-chain mint)
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
