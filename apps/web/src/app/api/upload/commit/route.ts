import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { uploadFile } from "@/lib/storage";
import { sanitizeFilename } from "@/lib/filename";
import {
  MAX_UPLOAD_BYTES,
  MAX_INPUT_DIM,
  MAX_MINT_DIM,
  MAX_THUMB_DIM,
  MAX_TOTAL_UPLOAD_BYTES,
  isAllowedUploadMime,
} from "@/lib/upload-constants";
import { sha256HexBuffer } from "@/lib/sha256";
import { buildUploadMetadata, UploadProvenance } from "@/lib/upload-metadata";
import { stableStringify } from "@artmint/common";

export const dynamic = "force-dynamic";

const metaSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  symbol: z.string().max(10).optional(),
  original: z.object({
    filename: z.string().min(1).max(200),
    mime: z.string().min(1),
    bytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
    width: z.number().int().min(1).max(MAX_INPUT_DIM),
    height: z.number().int().min(1).max(MAX_INPUT_DIM),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  mint: z.object({
    mime: z.string().min(1),
    bytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
    width: z.number().int().min(1).max(MAX_MINT_DIM),
    height: z.number().int().min(1).max(MAX_MINT_DIM),
    maxSide: z.number().int().min(512).max(MAX_MINT_DIM),
    fit: z.enum(["contain", "cover"]),
    format: z.enum(["webp", "png"]),
    quality: z.number().min(0.7).max(0.95).optional(),
  }),
  thumbnail: z.object({
    mime: z.literal("image/webp"),
    bytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
    width: z.number().int().min(1).max(MAX_THUMB_DIM),
    height: z.number().int().min(1).max(MAX_THUMB_DIM),
    maxSide: z.number().int().min(64).max(MAX_THUMB_DIM),
  }),
  createdAt: z.string().optional(),
  appVersion: z.string().optional(),
});

function fileFromFormData(value: FormDataEntryValue | null): File | null {
  if (!value) return null;
  if (typeof value === "string") return null;
  if (typeof (value as File).arrayBuffer !== "function") return null;
  return value as File;
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const wallet = authResult;

    const clientIp = getClientIp(req);
    const rateLimit = await checkRateLimit(`upload:${clientIp}`, 8, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.resetMs / 1000)) } }
      );
    }

    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_TOTAL_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `Request body too large (max ${Math.floor(MAX_TOTAL_UPLOAD_BYTES / (1024 * 1024))}MB)` },
        { status: 413 }
      );
    }

    const form = await req.formData();
    const originalFile = fileFromFormData(form.get("original"));
    const mintFile = fileFromFormData(form.get("mint"));
    const thumbFile = fileFromFormData(form.get("thumbnail"));
    const metaRaw = form.get("meta");

    if (!originalFile || !mintFile || !thumbFile || typeof metaRaw !== "string") {
      return NextResponse.json({ error: "Missing required upload fields" }, { status: 400 });
    }

    let metaJson: unknown;
    try {
      metaJson = JSON.parse(metaRaw);
    } catch {
      return NextResponse.json({ error: "Invalid metadata JSON" }, { status: 400 });
    }

    const metaParsed = metaSchema.safeParse(metaJson);
    if (!metaParsed.success) {
      return NextResponse.json(
        { error: "Invalid metadata", details: metaParsed.error.issues },
        { status: 400 }
      );
    }

    const meta = metaParsed.data;

    if (!isAllowedUploadMime(meta.original.mime)) {
      return NextResponse.json({ error: "Unsupported original file type" }, { status: 400 });
    }

    if (meta.mint.format === "webp" && meta.mint.mime !== "image/webp") {
      return NextResponse.json({ error: "Mint format mismatch" }, { status: 400 });
    }
    if (meta.mint.format === "png" && meta.mint.mime !== "image/png") {
      return NextResponse.json({ error: "Mint format mismatch" }, { status: 400 });
    }

    if (originalFile.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Original file too large" }, { status: 413 });
    }
    if (!isAllowedUploadMime(originalFile.type)) {
      return NextResponse.json({ error: "Unsupported original file type" }, { status: 400 });
    }

    if (originalFile.type !== meta.original.mime) {
      return NextResponse.json({ error: "Original mime mismatch" }, { status: 400 });
    }

    if (mintFile.type !== meta.mint.mime || thumbFile.type !== meta.thumbnail.mime) {
      return NextResponse.json({ error: "Output mime mismatch" }, { status: 400 });
    }

    const originalBuffer = Buffer.from(await originalFile.arrayBuffer());
    const mintBuffer = Buffer.from(await mintFile.arrayBuffer());
    const thumbBuffer = Buffer.from(await thumbFile.arrayBuffer());

    const originalSha256 = sha256HexBuffer(originalBuffer);
    if (meta.original.sha256 !== originalSha256) {
      return NextResponse.json({ error: "Original hash mismatch" }, { status: 400 });
    }
    if (meta.original.bytes !== originalBuffer.length) {
      return NextResponse.json({ error: "Original size mismatch" }, { status: 400 });
    }
    if (meta.mint.bytes !== mintBuffer.length || meta.thumbnail.bytes !== thumbBuffer.length) {
      return NextResponse.json({ error: "Output size mismatch" }, { status: 400 });
    }
    const safeFilename = sanitizeFilename(meta.original.filename) || `upload-${originalSha256.slice(0, 8)}`;

    const createdAt = meta.createdAt ?? new Date().toISOString();
    const appVersion = meta.appVersion;

    const fileId = `upload-${originalSha256.slice(0, 10)}`;
    const originalExt = safeFilename.includes(".") ? safeFilename.split(".").pop() : undefined;
    const originalName = originalExt ? `${fileId}-original.${originalExt}` : `${fileId}-original`;

    const [originalResult, mintResult, thumbResult] = await Promise.all([
      uploadFile(originalBuffer, originalName, meta.original.mime),
      uploadFile(mintBuffer, `${fileId}-mint.${meta.mint.format}`, meta.mint.mime),
      uploadFile(thumbBuffer, `${fileId}-thumb.webp`, meta.thumbnail.mime),
    ]);

    const mintQuality = meta.mint.format === "png" ? null : meta.mint.quality ?? 0.85;

    const provenance: UploadProvenance = {
      kind: "upload",
      createdAt,
      appVersion,
      rendererVersion: null,
      original: {
        sha256: originalSha256,
        filename: safeFilename,
        mime: meta.original.mime,
        bytes: originalBuffer.length,
        width: meta.original.width,
        height: meta.original.height,
        url: originalResult.url,
      },
      mint: {
        mime: meta.mint.mime,
        bytes: mintBuffer.length,
        width: meta.mint.width,
        height: meta.mint.height,
        format: meta.mint.format,
        quality: mintQuality,
        fit: meta.mint.fit,
        maxSide: meta.mint.maxSide,
        url: mintResult.url,
      },
      thumbnail: {
        mime: meta.thumbnail.mime,
        bytes: thumbBuffer.length,
        width: meta.thumbnail.width,
        height: meta.thumbnail.height,
        url: thumbResult.url,
      },
    };

    const metadata = buildUploadMetadata({
      name: meta.title ?? safeFilename,
      description: meta.description ?? "Uploaded artwork minted via ArtMint Studio.",
      symbol: meta.symbol ?? "ARTMINT",
      imageUrl: mintResult.url,
      mintMime: meta.mint.mime,
      thumbnailUrl: thumbResult.url,
      originalUrl: originalResult.url,
      provenance,
      externalUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/asset/pending`,
    });

    const metadataJson = JSON.stringify(metadata, null, 2);
    const metadataResult = await uploadFile(
      Buffer.from(metadataJson, "utf-8"),
      `${fileId}-metadata.json`,
      "application/json"
    );

    const placeholderMintAddress = `pending-${originalSha256.slice(0, 16)}`;

    await prisma.mint.create({
      data: {
        mintAddress: placeholderMintAddress,
        inputJson: stableStringify(provenance),
        hash: originalSha256,
        imageUrl: mintResult.url,
        animationUrl: mintResult.url,
        metadataUrl: metadataResult.url,
        title: meta.title ?? safeFilename,
        wallet,
      },
    });

    return NextResponse.json({
      success: true,
      hash: originalSha256,
      metadataUrl: metadataResult.url,
      imageUrl: mintResult.url,
      thumbnailUrl: thumbResult.url,
      originalUrl: originalResult.url,
      placeholderMintAddress,
      provenance,
    });
  } catch (err) {
    console.error("Upload commit error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Upload commit failed" }, { status: 500 });
  }
}
