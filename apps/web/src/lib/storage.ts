import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

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

  if (provider === "local") {
    ensureDir(STORAGE_DIR);
    const filePath = join(STORAGE_DIR, filename);
    writeFileSync(filePath, data);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return { url: `${baseUrl}/uploads/${filename}` };
  }

  // For irys/nftstorage, you'd implement the upload logic here
  // For MVP, we fall back to local
  ensureDir(STORAGE_DIR);
  const filePath = join(STORAGE_DIR, filename);
  writeFileSync(filePath, data);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return { url: `${baseUrl}/uploads/${filename}` };
}
