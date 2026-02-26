import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

vi.mock("@/lib/filename", () => ({
  sanitizeFilename: (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_"),
}));

import { GET } from "../app/api/artifact/route";

const uploadsDir = join(process.cwd(), "public", "uploads");

function makeReq(file?: string) {
  const query = file ? `?file=${encodeURIComponent(file)}` : "";
  return {
    nextUrl: new URL(`http://localhost:3000/api/artifact${query}`),
  } as any;
}

describe("/api/artifact", () => {
  beforeEach(() => {
    mkdirSync(uploadsDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(uploadsDir, { recursive: true, force: true });
  });

  it("serves local HTML artifacts with sandboxed headers", async () => {
    const filename = "test-artifact.html";
    writeFileSync(join(uploadsDir, filename), "<!doctype html><html></html>");

    const res = await GET(makeReq(filename));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(res.headers.get("content-security-policy")).toContain(
      "sandbox allow-scripts allow-downloads"
    );
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("rejects missing file parameter", async () => {
    const res = await GET(makeReq());

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("file");
  });
});
