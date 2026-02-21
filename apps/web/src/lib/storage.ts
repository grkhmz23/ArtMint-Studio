import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { put } from "@vercel/blob";
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
    return { url: `${baseUrl}/uploads/${safeFilename}` };
  }

  throw new Error(
    `Storage provider "${provider}" is not implemented. ` +
    `Set STORAGE_PROVIDER=local for development, or STORAGE_PROVIDER=vercel-blob for production.`
  );
}
