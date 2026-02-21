import { describe, it, expect } from "vitest";
import { sanitizeFilename } from "../lib/filename";
import { sha256Hex } from "../lib/sha256";

describe("upload utils", () => {
  it("sanitizes filenames", () => {
    expect(sanitizeFilename("../foo/bar.png")).toBe("bar.png");
    expect(sanitizeFilename("weird name$$.jpg")).toBe("weird_name__.jpg");
    expect(sanitizeFilename("..\\evil\\path.gif")).toBe("path.gif");
  });

  it("computes sha256", async () => {
    const encoder = new TextEncoder();
    const data = encoder.encode("hello");
    const hash = await sha256Hex(data.buffer);
    expect(hash).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });
});
