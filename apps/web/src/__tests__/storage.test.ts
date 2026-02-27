import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

const mocks = vi.hoisted(() => ({
  blobDelMock: vi.fn(),
  blobPutMock: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({
  put: mocks.blobPutMock,
  del: mocks.blobDelMock,
}));

vi.mock("@/lib/filename", () => ({
  sanitizeFilename: (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_"),
}));

import { deleteFile, uploadFile } from "../lib/storage";

const uploadsDir = join(process.cwd(), "public", "uploads");
const originalEnv = {
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER,
  BLOB_ACCESS: process.env.BLOB_ACCESS,
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN:
    process.env.BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
};

describe("storage.deleteFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mkdirSync(uploadsDir, { recursive: true });
  });

  afterEach(() => {
    if (originalEnv.STORAGE_PROVIDER === undefined) {
      delete process.env.STORAGE_PROVIDER;
    } else {
      process.env.STORAGE_PROVIDER = originalEnv.STORAGE_PROVIDER;
    }

    if (originalEnv.BLOB_ACCESS === undefined) {
      delete process.env.BLOB_ACCESS;
    } else {
      process.env.BLOB_ACCESS = originalEnv.BLOB_ACCESS;
    }

    if (originalEnv.BLOB_READ_WRITE_TOKEN === undefined) {
      delete process.env.BLOB_READ_WRITE_TOKEN;
    } else {
      process.env.BLOB_READ_WRITE_TOKEN = originalEnv.BLOB_READ_WRITE_TOKEN;
    }

    if (originalEnv.BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN === undefined) {
      delete process.env.BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN;
    } else {
      process.env.BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN =
        originalEnv.BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN;
    }

    if (originalEnv.NEXT_PUBLIC_APP_URL === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalEnv.NEXT_PUBLIC_APP_URL;
    }

    rmSync(uploadsDir, { recursive: true, force: true });
  });

  it("deletes local uploaded files via /uploads URL", async () => {
    process.env.STORAGE_PROVIDER = "local";

    const filename = "delete-me-test.txt";
    const filePath = join(uploadsDir, filename);
    writeFileSync(filePath, "hello");
    expect(existsSync(filePath)).toBe(true);

    await deleteFile(`http://localhost:3000/uploads/${filename}`);

    expect(existsSync(filePath)).toBe(false);
  });

  it("is a no-op for missing local files", async () => {
    process.env.STORAGE_PROVIDER = "local";

    await expect(
      deleteFile("http://localhost:3000/uploads/missing-file.txt")
    ).resolves.toBeUndefined();
  });

  it("deletes local uploaded files via /api/artifact proxy URL", async () => {
    process.env.STORAGE_PROVIDER = "local";

    const filename = "local-artifact-test.html";
    const filePath = join(uploadsDir, filename);
    writeFileSync(filePath, "<html></html>");
    expect(existsSync(filePath)).toBe(true);

    await deleteFile(
      `http://localhost:3000/api/artifact?file=${encodeURIComponent(filename)}`
    );

    expect(existsSync(filePath)).toBe(false);
  });

  it("deletes vercel blob URLs via private proxy wrapper", async () => {
    process.env.STORAGE_PROVIDER = "vercel-blob";

    await deleteFile(
      "/api/blob?url=https%3A%2F%2Fblob.vercel-storage.com%2Ffoo%2Fbar.webp"
    );

    expect(mocks.blobDelMock).toHaveBeenCalledTimes(1);
    expect(mocks.blobDelMock).toHaveBeenCalledWith(
      "https://blob.vercel-storage.com/foo/bar.webp"
    );
  });

  it("returns an absolute proxy URL for private blob uploads", async () => {
    process.env.STORAGE_PROVIDER = "vercel-blob";
    process.env.BLOB_ACCESS = "private";
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_primary";
    process.env.NEXT_PUBLIC_APP_URL = "https://devnet.artmintstudio.art";

    mocks.blobPutMock.mockResolvedValueOnce({
      url: "https://blob.vercel-storage.com/store/upload.webp",
    });

    await expect(
      uploadFile(Buffer.from("hello"), "upload.webp", "image/webp")
    ).resolves.toEqual({
      url:
        "https://devnet.artmintstudio.art/api/blob?url=" +
        encodeURIComponent("https://blob.vercel-storage.com/store/upload.webp"),
    });

    expect(mocks.blobPutMock).toHaveBeenCalledWith(
      "upload.webp",
      expect.any(Buffer),
      {
        access: "private",
        contentType: "image/webp",
        token: "vercel_blob_rw_primary",
      }
    );
  });

  it("retries with private access when a private store rejects public uploads", async () => {
    process.env.STORAGE_PROVIDER = "vercel-blob";
    process.env.BLOB_ACCESS = "public";
    delete process.env.BLOB_READ_WRITE_TOKEN;
    process.env.BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN =
      "vercel_blob_rw_fallback";
    process.env.NEXT_PUBLIC_APP_URL = "https://devnet.artmintstudio.art";

    mocks.blobPutMock
      .mockRejectedValueOnce(
        new Error(
          "Vercel Blob: Cannot use public access on a private store. The store is configured with private access."
        )
      )
      .mockResolvedValueOnce({
        url: "https://blob.vercel-storage.com/store/upload.webp",
      });

    await expect(
      uploadFile(Buffer.from("hello"), "upload.webp", "image/webp")
    ).resolves.toEqual({
      url:
        "https://devnet.artmintstudio.art/api/blob?url=" +
        encodeURIComponent("https://blob.vercel-storage.com/store/upload.webp"),
    });

    expect(mocks.blobPutMock).toHaveBeenCalledTimes(2);
    expect(mocks.blobPutMock).toHaveBeenNthCalledWith(
      1,
      "upload.webp",
      expect.any(Buffer),
      {
        access: "public",
        contentType: "image/webp",
        token: "vercel_blob_rw_fallback",
      }
    );
    expect(mocks.blobPutMock).toHaveBeenNthCalledWith(
      2,
      "upload.webp",
      expect.any(Buffer),
      {
        access: "private",
        contentType: "image/webp",
        token: "vercel_blob_rw_fallback",
      }
    );
  });
});
