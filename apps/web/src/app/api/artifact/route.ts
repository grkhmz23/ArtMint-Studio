import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { NextRequest, NextResponse } from "next/server";
import { sanitizeFilename } from "@/lib/filename";

export const dynamic = "force-dynamic";

const STORAGE_DIR = resolve(process.cwd(), "public", "uploads");

const SANDBOXED_ARTIFACT_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "connect-src 'none'",
  "font-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
  "sandbox allow-scripts allow-downloads",
].join("; ");

export async function GET(req: NextRequest) {
  const rawFile = req.nextUrl.searchParams.get("file");
  const filename = rawFile ? sanitizeFilename(rawFile) : "";

  if (!filename) {
    return NextResponse.json({ error: "Missing or invalid file parameter" }, { status: 400 });
  }

  const fullPath = resolve(STORAGE_DIR, filename);
  if (!fullPath.startsWith(STORAGE_DIR)) {
    return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
  }

  if (!existsSync(fullPath)) {
    return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  }

  let data: Buffer;
  try {
    data = readFileSync(fullPath);
  } catch (err) {
    console.error("Artifact proxy read error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to read artifact" }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(data.byteLength),
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": SANDBOXED_ARTIFACT_CSP,
    },
  });
}
