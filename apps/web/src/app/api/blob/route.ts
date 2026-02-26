import { NextRequest, NextResponse } from "next/server";
import { head } from "@vercel/blob";

export const dynamic = "force-dynamic";

// Untrusted HTML artifacts must run in a sandboxed document, even on the app origin.
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

function isHtmlContentType(contentType: string | undefined): boolean {
  if (!contentType) return false;
  return contentType.split(";")[0]?.trim().toLowerCase() === "text/html";
}

/**
 * GET /api/blob?url=<encoded-vercel-blob-url>
 *
 * Proxy for private Vercel Blob store files.
 * Fetches the blob server-side (using BLOB_READ_WRITE_TOKEN)
 * and streams it to the client with proper content-type and caching.
 */
export async function GET(req: NextRequest) {
  const blobUrl = req.nextUrl.searchParams.get("url");

  if (!blobUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Validate the URL points to Vercel Blob storage
  try {
    const parsed = new URL(blobUrl);
    if (!parsed.hostname.endsWith(".blob.vercel-storage.com")) {
      return NextResponse.json({ error: "Invalid blob URL" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    // Get blob metadata to confirm it exists and get content type
    const blobInfo = await head(blobUrl);
    const contentType = blobInfo.contentType || "application/octet-stream";
    const isHtml = isHtmlContentType(contentType);

    // Fetch the actual blob data using the token (set automatically by @vercel/blob)
    const response = await fetch(blobUrl, {
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Blob not found" }, { status: 404 });
    }

    const data = await response.arrayBuffer();

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(data.byteLength),
        "X-Content-Type-Options": "nosniff",
        // Allow the asset page to iframe the artifact, but keep other pages framed-denied.
        ...(isHtml ? { "X-Frame-Options": "SAMEORIGIN" } : {}),
        ...(isHtml ? { "Referrer-Policy": "no-referrer" } : {}),
        ...(isHtml ? { "Content-Security-Policy": SANDBOXED_ARTIFACT_CSP } : {}),
      },
    });
  } catch (err) {
    console.error("Blob proxy error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to fetch blob" }, { status: 500 });
  }
}
