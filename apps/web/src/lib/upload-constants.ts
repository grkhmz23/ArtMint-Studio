export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_INPUT_DIM = 8192;
export const MAX_MINT_DIM = 4096;
export const MAX_THUMB_DIM = 512;
export const MAX_TOTAL_UPLOAD_BYTES = 40 * 1024 * 1024;

export const ALLOWED_UPLOAD_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type AllowedUploadMime = (typeof ALLOWED_UPLOAD_MIME)[number];

export function isAllowedUploadMime(mime: string): mime is AllowedUploadMime {
  return (ALLOWED_UPLOAD_MIME as readonly string[]).includes(mime);
}
