import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

const mocks = vi.hoisted(() => ({
  blobDelMock: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
  del: mocks.blobDelMock,
}));

vi.mock("@/lib/filename", () => ({
  sanitizeFilename: (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_"),
}));

import { deleteFile } from "../lib/storage";

const uploadsDir = join(process.cwd(), "public", "uploads");
const originalEnv = {
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER,
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
});
