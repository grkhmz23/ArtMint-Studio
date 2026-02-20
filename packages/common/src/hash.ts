import { createHash } from "crypto";

/**
 * Stable JSON stringify with sorted keys.
 * Produces deterministic output regardless of key insertion order.
 */
export function stableStringify(obj: unknown): string {
  return JSON.stringify(obj, (_key, value) => {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((sorted, k) => {
          sorted[k] = (value as Record<string, unknown>)[k];
          return sorted;
        }, {});
    }
    return value as unknown;
  });
}

/**
 * Compute a deterministic SHA-256 hash of a canonical input object.
 */
export function computeHash(input: unknown): string {
  const serialized = stableStringify(input);
  return createHash("sha256").update(serialized).digest("hex");
}
