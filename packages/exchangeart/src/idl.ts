import type { Idl } from "@coral-xyz/anchor";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

function loadIdl(filename: string): Idl {
  // For bundler environments (Next.js), we use require
  // For Node.js ESM, we use fs
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data = require(`../../idls/${filename}`);
    return data as Idl;
  } catch {
    // Fallback for ESM
    const dir = dirname(fileURLToPath(import.meta.url));
    const path = join(dir, "..", "..", "idls", filename);
    const json = readFileSync(path, "utf-8");
    return JSON.parse(json) as Idl;
  }
}

export function loadCodeCanvasIdl(): Idl {
  return loadIdl("code-canvas-idl.json");
}

export function loadBuyNowEditionsIdl(): Idl {
  return loadIdl("buy-now-editions-idl.json");
}

export function loadOffersIdl(): Idl {
  return loadIdl("offers-idl.json");
}
