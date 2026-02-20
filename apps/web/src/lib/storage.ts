import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve, basename } from "path";
import { put } from "@vercel/blob";

const STORAGE_DIR = join(process.cwd(), "public", "uploads");

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export interface UploadResult {
  url: string;
}

export async function uploadFile(
  data: Buffer | string,
  filename: string,
  contentType: string
): Promise<UploadResult> {
  const provider = process.env.STORAGE_PROVIDER ?? "local";

  if (provider === "vercel-blob") {
    const safeFilename = basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!safeFilename) {
      throw new Error("Invalid filename");
    }

    const blob = await put(safeFilename, data, {
      access: "public",
      contentType,
    });

    return { url: blob.url };
  }

  if (provider === "local") {
    ensureDir(STORAGE_DIR);

    // Sanitize filename: strip path components to prevent directory traversal
    const safeFilename = basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
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
