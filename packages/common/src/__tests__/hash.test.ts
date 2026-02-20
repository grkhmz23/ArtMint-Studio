import { describe, it, expect } from "vitest";
import { stableStringify, computeHash } from "../hash";

describe("stableStringify", () => {
  it("produces identical output regardless of key order", () => {
    const a = { z: 1, a: 2, m: 3 };
    const b = { a: 2, m: 3, z: 1 };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it("handles nested objects", () => {
    const a = { outer: { z: 1, a: 2 }, first: true };
    const b = { first: true, outer: { a: 2, z: 1 } };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it("preserves array order", () => {
    const a = { arr: [1, 2, 3] };
    const b = { arr: [3, 2, 1] };
    expect(stableStringify(a)).not.toBe(stableStringify(b));
  });
});

describe("computeHash", () => {
  it("returns same hash for same input regardless of key order", () => {
    const a = { templateId: "flow_fields", seed: 42, palette: ["#ff0000"] };
    const b = { seed: 42, palette: ["#ff0000"], templateId: "flow_fields" };
    expect(computeHash(a)).toBe(computeHash(b));
  });

  it("returns different hash for different input", () => {
    const a = { seed: 42 };
    const b = { seed: 43 };
    expect(computeHash(a)).not.toBe(computeHash(b));
  });

  it("returns a 64-character hex string", () => {
    const hash = computeHash({ test: true });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
