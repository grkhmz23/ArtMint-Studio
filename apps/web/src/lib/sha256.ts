import { createHash } from "crypto";

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return bufferToHex(hashBuffer);
  }

  const hash = createHash("sha256");
  hash.update(Buffer.from(data));
  return hash.digest("hex");
}

export function sha256HexBuffer(data: Buffer): string {
  const hash = createHash("sha256");
  hash.update(data);
  return hash.digest("hex");
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}
