import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateSVG, renderPNGFromSVG, buildHtmlArtifact, RENDERER_VERSION } from "@artmint/render";
import { computeHash, stableStringify, flowFieldsParamsSchema, jazzNoirParamsSchema } from "@artmint/common";
import { uploadFile } from "@/lib/storage";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/auth";

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((value) => value.toLowerCase());
const flowFieldsParamsStrictSchema = flowFieldsParamsSchema.strict();
const jazzNoirParamsStrictSchema = jazzNoirParamsSchema.strict();
const METAPLEX_NAME_MAX_BYTES = 32;

function getTemplateParamsSchema(templateId: "flow_fields" | "jazz_noir") {
  return templateId === "flow_fields"
    ? flowFieldsParamsStrictSchema
    : jazzNoirParamsStrictSchema;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

async function buildDuplicatePendingMintResponse(
  placeholderMintAddress: string,
  wallet: string,
  fallbackCanonicalInput: unknown
): Promise<NextResponse | null> {
  const existing = await prisma.mint.findUnique({
    where: { mintAddress: placeholderMintAddress },
  });

  if (!existing) return null;

  if (existing.wallet !== wallet) {
    return NextResponse.json(
      {
        error: "An identical pending mint already exists for another wallet",
        code: "duplicate_pending_mint",
      },
      { status: 409 }
    );
  }

  let canonicalInput = fallbackCanonicalInput;
  try {
    canonicalInput = JSON.parse(existing.inputJson);
  } catch {
    // Fall back to the canonical input computed for this request.
  }

  return NextResponse.json({
    success: true,
    reused: true,
    hash: existing.hash,
    metadataUrl: existing.metadataUrl,
    imageUrl: existing.imageUrl,
    animationUrl: existing.animationUrl,
    placeholderMintAddress: existing.mintAddress,
    canonicalInput,
  });
}

const mintRequestSchema = z.object({
  templateId: z.enum(["flow_fields", "jazz_noir"]),
  seed: z.number().int().min(0).max(999999999),
  palette: z.array(hexColor).min(2).max(8),
  params: z.record(z.unknown()),
  prompt: z.string().trim().min(1).max(500),
  title: z.string().trim().max(200).optional(),
}).superRefine((data, ctx) => {
  const schema = getTemplateParamsSchema(data.templateId);
  const result = schema.safeParse(data.params);
  if (!result.success) {
    for (const issue of result.error.issues) {
      ctx.addIssue({
        ...issue,
        path: ["params", ...issue.path],
      });
    }
  }

  if (data.title && Buffer.byteLength(data.title, "utf8") > METAPLEX_NAME_MAX_BYTES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["title"],
      message: `Title exceeds on-chain metadata limit (${METAPLEX_NAME_MAX_BYTES} UTF-8 bytes max)`,
    });
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

    const templateId = parsed.data.templateId;
    const seed = parsed.data.seed;
    const palette = parsed.data.palette;
    const prompt = parsed.data.prompt;
    const title = normalizeOptionalText(parsed.data.title);
    const params = getTemplateParamsSchema(templateId).parse(parsed.data.params);

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
    const placeholderMintAddress = `pending-${hash.slice(0, 16)}`;

    const duplicateBeforeUpload = await buildDuplicatePendingMintResponse(
      placeholderMintAddress,
      wallet,
      canonicalInput
    );
    if (duplicateBeforeUpload) return duplicateBeforeUpload;

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
    try {
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
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const duplicateAfterUpload = await buildDuplicatePendingMintResponse(
          placeholderMintAddress,
          wallet,
          canonicalInput
        );
        if (duplicateAfterUpload) return duplicateAfterUpload;

        return NextResponse.json(
          { error: "Duplicate pending mint", code: "duplicate_pending_mint" },
          { status: 409 }
        );
      }
      throw err;
    }

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
    console.error("Mint preparation error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Mint preparation failed" }, { status: 500 });
  }
}
