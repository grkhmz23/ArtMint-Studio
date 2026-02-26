import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@vercel/blob", () => ({
  head: vi.fn(),
}));

import { head } from "@vercel/blob";
import { GET } from "../app/api/blob/route";

const mockHead = head as unknown as ReturnType<typeof vi.fn>;

function makeReq(blobUrl: string) {
  return {
    nextUrl: new URL(
      `http://localhost:3000/api/blob?url=${encodeURIComponent(blobUrl)}`
    ),
  } as any;
}

describe("/api/blob HTML artifact headers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).fetch = vi.fn();
  });

  it("applies sandboxed headers to HTML blobs", async () => {
    const blobUrl = "https://foo.blob.vercel-storage.com/artifact.html";
    mockHead.mockResolvedValue({ contentType: "text/html; charset=utf-8" });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("<!doctype html><html></html>", { status: 200 })
    );

    const res = await GET(makeReq(blobUrl));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("content-security-policy")).toContain(
      "sandbox allow-scripts allow-downloads"
    );
    expect(res.headers.get("content-security-policy")).toContain(
      "connect-src 'none'"
    );
  });

  it("does not apply sandboxed HTML headers to non-HTML blobs", async () => {
    const blobUrl = "https://foo.blob.vercel-storage.com/image.png";
    mockHead.mockResolvedValue({ contentType: "image/png" });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { status: 200 })
    );

    const res = await GET(makeReq(blobUrl));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBeNull();
    expect(res.headers.get("content-security-policy")).toBeNull();
    expect(res.headers.get("referrer-policy")).toBeNull();
  });
});
