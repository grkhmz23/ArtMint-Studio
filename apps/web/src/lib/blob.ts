const BLOB_TOKEN_PREFIX = "BLOB_READ_WRITE_TOKEN_";

export function getBlobReadWriteToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return process.env.BLOB_READ_WRITE_TOKEN;
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(BLOB_TOKEN_PREFIX) && value) {
      return value;
    }
  }

  return undefined;
}
