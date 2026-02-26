import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { uploadFile, deleteFile } from "@/lib/storage";
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
import { getImageDimensionsFromBuffer } from "@/lib/image-dimensions";
import { buildUploadMetadata, UploadProvenance } from "@/lib/upload-metadata";
import { stableStringify } from "@artmint/common";

export const dynamic = "force-dynamic";

const mimeString = z.string().trim().min(1).transform((value) => value.toLowerCase());
const optionalTrimmedText = (max: number) => z.string().trim().max(max).optional();

const metaSchema = z.object({
  title: optionalTrimmedText(200),
  description: optionalTrimmedText(500),
  symbol: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .transform((value) => value.toUpperCase())
    .optional(),
  original: z.object({
    filename: z.string().trim().min(1).max(200),
    mime: mimeString,
    bytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
    width: z.number().int().min(1).max(MAX_INPUT_DIM),
    height: z.number().int().min(1).max(MAX_INPUT_DIM),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  mint: z.object({
    mime: mimeString,
    bytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
    width: z.number().int().min(1).max(MAX_MINT_DIM),
    height: z.number().int().min(1).max(MAX_MINT_DIM),
    maxSide: z.number().int().min(1).max(MAX_MINT_DIM),
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
  createdAt: z.string().trim().max(64).optional(),
  appVersion: optionalTrimmedText(100),
});

function fileFromFormData(value: FormDataEntryValue | null): File | null {
  if (!value) return null;
  if (typeof value === "string") return null;
  if (typeof (value as File).arrayBuffer !== "function") return null;
  return value as File;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

async function cleanupUploadedUrls(urls: string[], reason: string): Promise<void> {
  if (urls.length === 0) return;
  const uniqueUrls = Array.from(new Set(urls));
  const cleanupResults = await Promise.allSettled(
    uniqueUrls.map((url) => deleteFile(url))
  );

  const failures = cleanupResults
    .map((result, index) => ({ result, url: uniqueUrls[index]! }))
    .filter((entry) => entry.result.status === "rejected");

  if (failures.length > 0) {
    console.warn(
      "Upload cleanup partial failure:",
      reason,
      failures.map((f) => ({
        url: f.url,
        error: f.result.status === "rejected"
          ? (f.result.reason instanceof Error ? f.result.reason.message : String(f.result.reason))
          : undefined,
      }))
    );
  }
}

async function buildDuplicatePendingMintResponse(
  placeholderMintAddress: string,
  wallet: string
): Promise<NextResponse | null> {
  const existing = await prisma.mint.findUnique({
    where: { mintAddress: placeholderMintAddress },
  });

  if (!existing) return null;

  if (existing.wallet !== wallet) {
    return NextResponse.json(
      {
        error: "An identical pending upload mint already exists for another wallet",
        code: "duplicate_pending_mint",
      },
      { status: 409 }
    );
  }

  let provenance: UploadProvenance | null = null;
  try {
    provenance = JSON.parse(existing.inputJson) as UploadProvenance;
  } catch {
    // If parsing fails, still return the existing pending mint metadata.
  }

  return NextResponse.json({
    success: true,
    reused: true,
    hash: existing.hash,
    metadataUrl: existing.metadataUrl,
    imageUrl: existing.imageUrl,
    thumbnailUrl: provenance?.thumbnail.url,
    originalUrl: provenance?.original.url,
    placeholderMintAddress: existing.mintAddress,
    provenance,
  });
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

    const originalFileType = originalFile.type.toLowerCase();
    const mintFileType = mintFile.type.toLowerCase();
    const thumbFileType = thumbFile.type.toLowerCase();

    if (originalFileType !== meta.original.mime) {
      return NextResponse.json({ error: "Original mime mismatch" }, { status: 400 });
    }

    if (mintFileType !== meta.mint.mime || thumbFileType !== meta.thumbnail.mime) {
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

    let originalDims;
    let mintDims;
    let thumbDims;
    try {
      originalDims = getImageDimensionsFromBuffer(originalBuffer, meta.original.mime);
      mintDims = getImageDimensionsFromBuffer(mintBuffer, meta.mint.mime);
      thumbDims = getImageDimensionsFromBuffer(thumbBuffer, meta.thumbnail.mime);
    } catch (err) {
      return NextResponse.json(
        {
          error: `Failed to read uploaded image dimensions: ${err instanceof Error ? err.message : String(err)}`,
        },
        { status: 400 }
      );
    }

    if (originalDims.width !== meta.original.width || originalDims.height !== meta.original.height) {
      return NextResponse.json({ error: "Original dimensions mismatch" }, { status: 400 });
    }
    if (mintDims.width !== meta.mint.width || mintDims.height !== meta.mint.height) {
      return NextResponse.json({ error: "Mint output dimensions mismatch" }, { status: 400 });
    }
    if (thumbDims.width !== meta.thumbnail.width || thumbDims.height !== meta.thumbnail.height) {
      return NextResponse.json({ error: "Thumbnail dimensions mismatch" }, { status: 400 });
    }

    const safeFilename = sanitizeFilename(meta.original.filename) || `upload-${originalSha256.slice(0, 8)}`;
    const title = normalizeOptionalText(meta.title);
    const description = normalizeOptionalText(meta.description);
    const symbol = meta.symbol ?? "ARTMINT";

    const createdAtDate = meta.createdAt ? new Date(meta.createdAt) : new Date();
    if (Number.isNaN(createdAtDate.getTime())) {
      return NextResponse.json({ error: "Invalid createdAt timestamp" }, { status: 400 });
    }
    const createdAt = createdAtDate.toISOString();
    const appVersion = normalizeOptionalText(meta.appVersion);

    const fileId = `upload-${originalSha256.slice(0, 10)}`;
    const placeholderMintAddress = `pending-${originalSha256.slice(0, 16)}`;

    const duplicateBeforeUpload = await buildDuplicatePendingMintResponse(
      placeholderMintAddress,
      wallet
    );
    if (duplicateBeforeUpload) return duplicateBeforeUpload;

    const originalExt = safeFilename.includes(".") ? safeFilename.split(".").pop() : undefined;
    const originalName = originalExt ? `${fileId}-original.${originalExt}` : `${fileId}-original`;

    const uploadedUrls: string[] = [];
    const baseUploadResults = await Promise.allSettled([
      uploadFile(originalBuffer, originalName, meta.original.mime),
      uploadFile(mintBuffer, `${fileId}-mint.${meta.mint.format}`, meta.mint.mime),
      uploadFile(thumbBuffer, `${fileId}-thumb.webp`, meta.thumbnail.mime),
    ]);

    const baseUploadFailures = baseUploadResults.filter((r) => r.status === "rejected");
    const baseUploadSuccesses = baseUploadResults.filter((r): r is PromiseFulfilledResult<{ url: string }> => r.status === "fulfilled");
    uploadedUrls.push(...baseUploadSuccesses.map((r) => r.value.url));

    if (baseUploadFailures.length > 0) {
      await cleanupUploadedUrls(uploadedUrls, "base uploads failed");
      const firstErr = baseUploadFailures[0]!.reason;
      throw firstErr instanceof Error ? firstErr : new Error(String(firstErr));
    }

    const [originalResult, mintResult, thumbResult] = baseUploadSuccesses.map((r) => r.value);

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
      name: title ?? safeFilename,
      description: description ?? "Uploaded artwork minted via ArtMint Studio.",
      symbol,
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
    uploadedUrls.push(metadataResult.url);

    try {
      await prisma.mint.create({
        data: {
          mintAddress: placeholderMintAddress,
          inputJson: stableStringify(provenance),
          hash: originalSha256,
          imageUrl: mintResult.url,
          animationUrl: mintResult.url,
          metadataUrl: metadataResult.url,
          title: title ?? safeFilename,
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
          wallet
        );
        await cleanupUploadedUrls(uploadedUrls, "duplicate pending mint after uploads");
        if (duplicateAfterUpload) return duplicateAfterUpload;

        return NextResponse.json(
          { error: "Duplicate pending mint", code: "duplicate_pending_mint" },
          { status: 409 }
        );
      }
      await cleanupUploadedUrls(uploadedUrls, "database create failed");
      throw err;
    }

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
