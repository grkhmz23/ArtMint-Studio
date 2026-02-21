import { describe, it, expect } from "vitest";
import { buildUploadMetadata, UploadProvenance } from "../lib/upload-metadata";

describe("upload metadata builder", () => {
  it("includes provenance fields and files", () => {
    const provenance: UploadProvenance = {
      kind: "upload",
      createdAt: new Date().toISOString(),
      appVersion: "test",
      original: {
        sha256: "a".repeat(64),
        filename: "original.png",
        mime: "image/png",
        bytes: 123,
        width: 100,
        height: 200,
        url: "https://example.com/original.png",
      },
      mint: {
        mime: "image/webp",
        bytes: 456,
        width: 2048,
        height: 2048,
        format: "webp",
        quality: 0.85,
        fit: "contain",
        maxSide: 2048,
        url: "https://example.com/mint.webp",
      },
      thumbnail: {
        mime: "image/webp",
        bytes: 78,
        width: 512,
        height: 512,
        url: "https://example.com/thumb.webp",
      },
    };

    const metadata = buildUploadMetadata({
      name: "Test Upload",
      description: "desc",
      symbol: "ART",
      imageUrl: provenance.mint.url,
      mintMime: provenance.mint.mime,
      thumbnailUrl: provenance.thumbnail.url,
      originalUrl: provenance.original.url,
      provenance,
      externalUrl: "https://example.com/asset/pending",
    });

    expect(metadata.image).toBe(provenance.mint.url);
    expect(metadata.properties.files.length).toBe(3);
    expect(metadata.properties.provenance.original.sha256).toBe(provenance.original.sha256);
    const kinds = metadata.attributes.map((a: { trait_type: string }) => a.trait_type);
    expect(kinds).toContain("Kind");
    expect(kinds).toContain("Original SHA-256");
  });
});
