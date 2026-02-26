import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildCustomCodeArtifact, buildCustomSvgArtifact, RENDERER_VERSION } from "@artmint/render";
import { computeHash, stableStringify } from "@artmint/common";
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
const METAPLEX_NAME_MAX_BYTES = 32;

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeCodeForCanonicalization(code: string): string {
  return code.replace(/\r\n?/g, "\n");
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
    // Fall back to this request's canonical input.
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

const customMintSchema = z.object({
  code: z.string().min(1).max(100_000),
  mode: z.enum(["svg", "javascript"]).default("svg"),
  seed: z.number().int().min(0).max(999999999),
  palette: z.array(hexColor).min(2).max(8),
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(500).optional(),
  pngBase64: z
    .string()
    .min(1)
    .max(10_000_000)
    .regex(/^data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/),
}).superRefine((data, ctx) => {
  if (data.title && Buffer.byteLength(data.title, "utf8") > METAPLEX_NAME_MAX_BYTES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["title"],
      message: `Title exceeds on-chain metadata limit (${METAPLEX_NAME_MAX_BYTES} UTF-8 bytes max)`,
    });
  }
});

export async function POST(req: NextRequest) {
  // Auth
  let wallet: string;
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    wallet = authResult;
  } catch (err) {
    console.error("Custom mint auth error:", err);
    return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
  }

  // Rate limit
  try {
    const clientIp = getClientIp(req);
    const rateLimit = await checkRateLimit(`mint:${clientIp}`, 10, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.resetMs / 1000)) } }
      );
    }
  } catch (err) {
    console.error("Custom mint rate limit error:", err);
    return NextResponse.json(
      { error: "Rate limit service unavailable", code: "rate_limit_unavailable" },
      { status: 503 }
    );
  }

  // Body size guard
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 12_000_000) {
    return NextResponse.json({ error: "Request body too large (max 12MB)" }, { status: 413 });
  }

  // Parse body
  let parsed;
  try {
    const body = await req.json();
    parsed = customMintSchema.safeParse(body);
  } catch (err) {
    console.error("Custom mint body parse error:", err);
    return NextResponse.json({ error: "Failed to parse request body" }, { status: 400 });
  }

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const seed = parsed.data.seed;
  const mode = parsed.data.mode;
  const palette = parsed.data.palette;
  const title = normalizeOptionalText(parsed.data.title);
  const description = normalizeOptionalText(parsed.data.description);
  const pngBase64 = parsed.data.pngBase64;
  const code = normalizeCodeForCanonicalization(parsed.data.code);

  try {
    // Decode base64 image from client canvas capture (supports png and jpeg data URLs)
    const pngData = pngBase64.replace(/^data:image\/[a-z]+;base64,/, "");
    const pngBuffer = Buffer.from(pngData, "base64");

    if (pngBuffer.length < 100) {
      return NextResponse.json({ error: "Image capture appears empty — try again" }, { status: 400 });
    }

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
    const placeholderMintAddress = `pending-${hash.slice(0, 16)}`;

    const duplicateBeforeUpload = await buildDuplicatePendingMintResponse(
      placeholderMintAddress,
      wallet,
      canonicalInput
    );
    if (duplicateBeforeUpload) return duplicateBeforeUpload;

    // Build HTML artifact
    let htmlArtifact: string;
    try {
      htmlArtifact = mode === "svg"
        ? buildCustomSvgArtifact({ code })
        : buildCustomCodeArtifact({ code, seed, palette });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Artifact build error:", msg);
      return NextResponse.json({ error: `Failed to build artifact: ${msg}` }, { status: 500 });
    }

    // Upload assets
    const fileId = `custom-${seed}-${hash.slice(0, 8)}`;
    let imageResult, animationResult;
    try {
      [imageResult, animationResult] = await Promise.all([
        uploadFile(pngBuffer, `${fileId}.png`, "image/png"),
        uploadFile(Buffer.from(htmlArtifact, "utf-8"), `${fileId}.html`, "text/html"),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Storage upload error:", msg);
      return NextResponse.json({ error: `Storage upload failed: ${msg}` }, { status: 500 });
    }

    // Build & upload metadata JSON
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

    let metadataResult;
    try {
      const metadataJson = JSON.stringify(metadata, null, 2);
      metadataResult = await uploadFile(
        Buffer.from(metadataJson, "utf-8"),
        `${fileId}-metadata.json`,
        "application/json"
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Metadata upload error:", msg);
      return NextResponse.json({ error: `Metadata upload failed: ${msg}` }, { status: 500 });
    }

    // Save to database
    try {
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

      const msg = err instanceof Error ? err.message : String(err);
      console.error("Database save error:", msg);
      return NextResponse.json({ error: `Database save failed: ${msg}` }, { status: 500 });
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
    const message = err instanceof Error ? err.message : String(err);
    console.error("Custom mint unexpected error:", message, err instanceof Error ? err.stack : "");
    return NextResponse.json(
      { error: `Mint failed: ${message}` },
      { status: 500 }
    );
  }
}
