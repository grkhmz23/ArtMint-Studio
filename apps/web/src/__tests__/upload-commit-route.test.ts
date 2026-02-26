import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => {
  return {
    requireAuth: vi.fn(),
    checkRateLimit: vi.fn(),
    getClientIp: vi.fn(),
    uploadFile: vi.fn(),
    deleteFile: vi.fn(),
    buildUploadMetadata: vi.fn(),
    getImageDimensionsFromBuffer: vi.fn(),
    mintFindUnique: vi.fn(),
    mintCreate: vi.fn(),
  };
});

vi.mock("@/lib/auth", () => ({
  requireAuth: mocks.requireAuth,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: mocks.getClientIp,
}));

vi.mock("@/lib/storage", () => ({
  uploadFile: mocks.uploadFile,
  deleteFile: mocks.deleteFile,
}));

vi.mock("@/lib/filename", () => ({
  sanitizeFilename: (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_"),
}));

vi.mock("@/lib/upload-constants", () => ({
  MAX_UPLOAD_BYTES: 25 * 1024 * 1024,
  MAX_INPUT_DIM: 8192,
  MAX_MINT_DIM: 4096,
  MAX_THUMB_DIM: 512,
  MAX_TOTAL_UPLOAD_BYTES: 50 * 1024 * 1024,
  isAllowedUploadMime: (mime: string) =>
    ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(mime),
}));

vi.mock("@/lib/sha256", () => ({
  sha256HexBuffer: (buf: Buffer) => createHash("sha256").update(buf).digest("hex"),
}));

vi.mock("@/lib/image-dimensions", () => ({
  getImageDimensionsFromBuffer: mocks.getImageDimensionsFromBuffer,
}));

vi.mock("@/lib/upload-metadata", () => ({
  buildUploadMetadata: mocks.buildUploadMetadata,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    mint: {
      create: mocks.mintCreate,
      findUnique: mocks.mintFindUnique,
    },
  },
}));

import { POST as uploadCommitPost } from "../app/api/upload/commit/route";

function sha256Hex(data: Uint8Array) {
  return createHash("sha256").update(data).digest("hex");
}

function makeFormReq(form: FormData, headers?: Record<string, string>) {
  return {
    headers: new Headers(headers),
    formData: async () => form,
  } as any;
}

function buildValidUploadForm() {
  const originalBytes = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const mintBytes = Uint8Array.from({ length: 64 }, (_, i) => (i + 1) % 255);
  const thumbBytes = Uint8Array.from({ length: 32 }, (_, i) => (i + 2) % 255);

  const original = new File([originalBytes], "sample.png", { type: "image/png" });
  const mint = new File([mintBytes], "mint.webp", { type: "image/webp" });
  const thumbnail = new File([thumbBytes], "thumb.webp", { type: "image/webp" });

  const meta = {
    title: "Upload Test",
    description: "Test upload flow",
    original: {
      filename: "sample.png",
      mime: "image/png",
      bytes: original.size,
      width: 512,
      height: 512,
      sha256: sha256Hex(originalBytes),
    },
    mint: {
      mime: "image/webp",
      bytes: mint.size,
      width: 1024,
      height: 1024,
      maxSide: 2048,
      fit: "contain",
      format: "webp",
      quality: 0.85,
    },
    thumbnail: {
      mime: "image/webp",
      bytes: thumbnail.size,
      width: 256,
      height: 256,
      maxSide: 512,
    },
    createdAt: "2026-02-26T00:00:00.000Z",
    appVersion: "test",
  };

  const form = new FormData();
  form.append("original", original);
  form.append("mint", mint);
  form.append("thumbnail", thumbnail);
  form.append("meta", JSON.stringify(meta));

  return { form, meta, originalBytes };
}

function mockValidDimensions() {
  mocks.getImageDimensionsFromBuffer
    .mockReset()
    .mockReturnValueOnce({ width: 512, height: 512 })   // original
    .mockReturnValueOnce({ width: 1024, height: 1024 }) // mint
    .mockReturnValueOnce({ width: 256, height: 256 });  // thumbnail
}

describe("/api/upload/commit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue("Wallet111111111111111111111111111111111111111");
    mocks.getClientIp.mockReturnValue("127.0.0.1");
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, resetMs: 0 });
    mocks.uploadFile.mockImplementation(async (_data: unknown, filename: string) => ({
      url: `https://storage.test/${filename}`,
    }));
    mocks.deleteFile.mockResolvedValue(undefined);
    mocks.buildUploadMetadata.mockImplementation((args: any) => ({
      name: args.name,
      description: args.description,
      symbol: args.symbol,
      image: args.imageUrl,
      external_url: args.externalUrl,
      properties: {
        provenance: args.provenance,
      },
    }));
    mockValidDimensions();
    mocks.mintFindUnique.mockResolvedValue(null);
    mocks.mintCreate.mockResolvedValue({ id: "mint-upload-1" });
  });

  it("stores uploaded-image mint provenance and creates a pending mint record", async () => {
    const { form } = buildValidUploadForm();

    const res = await uploadCommitPost(makeFormReq(form));

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.placeholderMintAddress).toMatch(/^pending-/);
    expect(json.provenance.kind).toBe("upload");
    expect(json.imageUrl).toContain("-mint.webp");
    expect(json.thumbnailUrl).toContain("-thumb.webp");
    expect(json.metadataUrl).toContain("-metadata.json");
    expect(mocks.uploadFile).toHaveBeenCalledTimes(4);
    expect(mocks.mintCreate).toHaveBeenCalledTimes(1);

    const createArg = mocks.mintCreate.mock.calls[0][0];
    expect(createArg.data.wallet).toBe("Wallet111111111111111111111111111111111111111");
    expect(createArg.data.mintAddress).toBe(json.placeholderMintAddress);
    expect(createArg.data.animationUrl).toBe(createArg.data.imageUrl);
  });

  it("normalizes title/symbol metadata before persistence", async () => {
    const { form, meta } = buildValidUploadForm();
    form.set(
      "meta",
      JSON.stringify({
        ...meta,
        title: "  Upload Test  ",
        description: "  Test upload flow  ",
        symbol: " art_1 ",
      })
    );

    const res = await uploadCommitPost(makeFormReq(form));

    expect(res.status).toBe(200);
    const createArg = mocks.mintCreate.mock.calls[0][0];
    expect(createArg.data.title).toBe("Upload Test");

    const metadataArg = mocks.buildUploadMetadata.mock.calls[0][0];
    expect(metadataArg.name).toBe("Upload Test");
    expect(metadataArg.description).toBe("Test upload flow");
    expect(metadataArg.symbol).toBe("ART_1");
  });

  it("returns idempotent success when the same pending upload already exists", async () => {
    const { form } = buildValidUploadForm();
    mocks.mintFindUnique.mockResolvedValue({
      mintAddress: "pending-existingupload",
      wallet: "Wallet111111111111111111111111111111111111111",
      status: "pending",
      hash: "c".repeat(64),
      metadataUrl: "https://storage.test/existing-meta.json",
      imageUrl: "https://storage.test/existing-mint.webp",
      animationUrl: "https://storage.test/existing-mint.webp",
      inputJson: JSON.stringify({
        kind: "upload",
        original: { url: "https://storage.test/original.png" },
        mint: { url: "https://storage.test/existing-mint.webp" },
        thumbnail: { url: "https://storage.test/existing-thumb.webp" },
      }),
    });

    const res = await uploadCommitPost(makeFormReq(form));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reused).toBe(true);
    expect(json.placeholderMintAddress).toBe("pending-existingupload");
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    expect(mocks.mintCreate).not.toHaveBeenCalled();
  });

  it("handles upload create races via P2002", async () => {
    const p2002 = Object.create(
      Prisma.PrismaClientKnownRequestError.prototype
    ) as Prisma.PrismaClientKnownRequestError;
    (p2002 as any).code = "P2002";
    (p2002 as any).message = "Unique constraint failed";

    const { form } = buildValidUploadForm();
    mocks.mintCreate.mockRejectedValueOnce(p2002);
    mocks.mintFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        mintAddress: "pending-raceupload",
        wallet: "Wallet111111111111111111111111111111111111111",
        status: "pending",
        hash: "d".repeat(64),
        metadataUrl: "https://storage.test/raceupload-meta.json",
        imageUrl: "https://storage.test/raceupload-mint.webp",
        animationUrl: "https://storage.test/raceupload-mint.webp",
        inputJson: JSON.stringify({
          kind: "upload",
          original: { url: "https://storage.test/raceupload-original.png" },
          mint: { url: "https://storage.test/raceupload-mint.webp" },
          thumbnail: { url: "https://storage.test/raceupload-thumb.webp" },
        }),
      });

    const res = await uploadCommitPost(makeFormReq(form));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reused).toBe(true);
    expect(mocks.deleteFile).toHaveBeenCalledTimes(4);
  });

  it("rejects when original hash does not match metadata", async () => {
    const { form, meta } = buildValidUploadForm();
    const tamperedMeta = { ...meta, original: { ...meta.original, sha256: "0".repeat(64) } };
    form.set("meta", JSON.stringify(tamperedMeta));

    const res = await uploadCommitPost(makeFormReq(form));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Original hash mismatch");
    expect(mocks.mintCreate).not.toHaveBeenCalled();
  });

  it("rejects when server-side dimensions do not match metadata", async () => {
    const { form } = buildValidUploadForm();
    mocks.getImageDimensionsFromBuffer
      .mockReset()
      .mockReturnValueOnce({ width: 999, height: 512 })   // original mismatch
      .mockReturnValueOnce({ width: 1024, height: 1024 })
      .mockReturnValueOnce({ width: 256, height: 256 });

    const res = await uploadCommitPost(makeFormReq(form));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Original dimensions mismatch");
    expect(mocks.uploadFile).not.toHaveBeenCalled();
  });

  it("cleans up uploaded files when DB create fails", async () => {
    const { form } = buildValidUploadForm();
    mocks.mintCreate.mockRejectedValueOnce(new Error("db unavailable"));

    const res = await uploadCommitPost(makeFormReq(form));

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Upload commit failed");
    expect(mocks.deleteFile).toHaveBeenCalledTimes(4);

    const deletedUrls = mocks.deleteFile.mock.calls.map((call: any[]) => call[0]);
    expect(deletedUrls).toEqual([
      "https://storage.test/upload-206402cab3-original.png",
      "https://storage.test/upload-206402cab3-mint.webp",
      "https://storage.test/upload-206402cab3-thumb.webp",
      "https://storage.test/upload-206402cab3-metadata.json",
    ]);
  });

  it("rejects malformed/missing form fields", async () => {
    const form = new FormData();
    form.append("meta", JSON.stringify({ foo: "bar" }));

    const res = await uploadCommitPost(makeFormReq(form));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Missing required upload fields");
  });

  it("enforces upload request body limit", async () => {
    const { form } = buildValidUploadForm();

    const res = await uploadCommitPost(
      makeFormReq(form, { "content-length": String(100 * 1024 * 1024) })
    );

    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.error).toContain("Request body too large");
    expect(mocks.mintCreate).not.toHaveBeenCalled();
  });
});
