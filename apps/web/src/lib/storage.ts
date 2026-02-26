import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { join, resolve } from "path";
import { put, del } from "@vercel/blob";
import { sanitizeFilename } from "@/lib/filename";

const STORAGE_DIR = join(process.cwd(), "public", "uploads");

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export interface UploadResult {
  url: string;
}

function getUploadsRoot(): string {
  return resolve(STORAGE_DIR);
}

function normalizeUrlLike(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    try {
      return new URL(value, "http://local.test");
    } catch {
      return null;
    }
  }
}

function isHtmlContentType(contentType: string): boolean {
  return contentType.split(";")[0]?.trim().toLowerCase() === "text/html";
}

function extractBlobUrlFromStoredUrl(url: string): string {
  const parsed = normalizeUrlLike(url);
  if (!parsed) {
    throw new Error("Invalid URL");
  }

  if (parsed.pathname === "/api/blob") {
    const proxied = parsed.searchParams.get("url");
    if (!proxied) {
      throw new Error("Missing proxied blob URL");
    }
    return proxied;
  }

  return parsed.toString();
}

function resolveLocalUploadPathFromUrl(url: string): string {
  const parsed = normalizeUrlLike(url);
  if (!parsed) {
    throw new Error("Invalid URL");
  }

  const pathname = parsed.pathname || "";
  let rawFilename = "";
  if (pathname.startsWith("/uploads/")) {
    rawFilename = pathname.slice("/uploads/".length);
  } else if (pathname === "/api/artifact") {
    rawFilename = parsed.searchParams.get("file") ?? "";
  } else {
    throw new Error("URL is not an uploads path");
  }

  const filename = sanitizeFilename(rawFilename);
  if (!filename) {
    throw new Error("Invalid upload filename");
  }

  const fullPath = resolve(STORAGE_DIR, filename);
  if (!fullPath.startsWith(getUploadsRoot())) {
    throw new Error("Resolved upload path is outside uploads directory");
  }

  return fullPath;
}

/**
 * Determine whether the Vercel Blob store uses public or private access.
 * Set BLOB_ACCESS=private in env if your store is private.
 */
function getBlobAccess(): "public" | "private" {
  const val = process.env.BLOB_ACCESS?.toLowerCase();
  if (val === "private") return "private";
  return "public";
}

export async function uploadFile(
  data: Buffer | string,
  filename: string,
  contentType: string
): Promise<UploadResult> {
  const provider = process.env.STORAGE_PROVIDER ?? "local";

  if (provider === "vercel-blob") {
    const safeFilename = sanitizeFilename(filename);
    if (!safeFilename) {
      throw new Error("Invalid filename");
    }

    const access = getBlobAccess();

    const blob = await put(safeFilename, data, {
      access,
      contentType,
    });

    // For private stores, rewrite URLs to go through our proxy endpoint
    // so browser <img> tags and fetch calls can access them.
    if (access === "private") {
      const proxyUrl = `/api/blob?url=${encodeURIComponent(blob.url)}`;
      return { url: proxyUrl };
    }

    return { url: blob.url };
  }

  if (provider === "local") {
    ensureDir(STORAGE_DIR);

    // Sanitize filename: strip path components to prevent directory traversal
    const safeFilename = sanitizeFilename(filename);
    if (!safeFilename) {
      throw new Error("Invalid filename");
    }

    const filePath = resolve(STORAGE_DIR, safeFilename);

    // Double-check the resolved path is within STORAGE_DIR
    if (!filePath.startsWith(resolve(STORAGE_DIR))) {
      throw new Error("Invalid file path");
    }

    writeFileSync(filePath, data);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    if (isHtmlContentType(contentType)) {
      return { url: `${baseUrl}/api/artifact?file=${encodeURIComponent(safeFilename)}` };
    }
    return { url: `${baseUrl}/uploads/${safeFilename}` };
  }

  throw new Error(
    `Storage provider "${provider}" is not implemented. ` +
    `Set STORAGE_PROVIDER=local for development, or STORAGE_PROVIDER=vercel-blob for production.`
  );
}

export async function deleteFile(url: string): Promise<void> {
  const provider = process.env.STORAGE_PROVIDER ?? "local";

  if (provider === "vercel-blob") {
    const blobUrl = extractBlobUrlFromStoredUrl(url);
    await del(blobUrl);
    return;
  }

  if (provider === "local") {
    const filePath = resolveLocalUploadPathFromUrl(url);
    if (!existsSync(filePath)) return;
    unlinkSync(filePath);
    return;
  }

  throw new Error(
    `Storage provider "${provider}" is not implemented. ` +
    `Set STORAGE_PROVIDER=local for development, or STORAGE_PROVIDER=vercel-blob for production.`
  );
}
