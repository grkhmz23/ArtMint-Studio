import { NextRequest, NextResponse } from "next/server";
import { head } from "@vercel/blob";

export const dynamic = "force-dynamic";

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
        "Content-Type": blobInfo.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(data.byteLength),
      },
    });
  } catch (err) {
    console.error("Blob proxy error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to fetch blob" }, { status: 500 });
  }
}
