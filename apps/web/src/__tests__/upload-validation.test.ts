import { describe, it, expect } from "vitest";
import { validateOriginalMeta } from "../lib/upload-validation";
import { MAX_UPLOAD_BYTES } from "../lib/upload-constants";

describe("upload validation", () => {
  it("rejects svg mime types", () => {
    const result = validateOriginalMeta({
      mime: "image/svg+xml",
      bytes: 1000,
      width: 100,
      height: 100,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects files over 25MB", () => {
    const result = validateOriginalMeta({
      mime: "image/png",
      bytes: MAX_UPLOAD_BYTES + 1,
      width: 100,
      height: 100,
    });
    expect(result.ok).toBe(false);
  });

  it("accepts png, jpeg, webp", () => {
    for (const mime of ["image/png", "image/jpeg", "image/webp"]) {
      const result = validateOriginalMeta({
        mime,
        bytes: 1000,
        width: 100,
        height: 100,
      });
      expect(result.ok).toBe(true);
    }
  });
});
