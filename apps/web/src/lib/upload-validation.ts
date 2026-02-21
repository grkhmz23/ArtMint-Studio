import { isAllowedUploadMime, MAX_INPUT_DIM, MAX_UPLOAD_BYTES } from "./upload-constants";

export function validateOriginalMeta(meta: {
  mime: string;
  bytes: number;
  width: number;
  height: number;
}): { ok: true } | { ok: false; error: string } {
  if (!isAllowedUploadMime(meta.mime)) {
    return { ok: false, error: "Unsupported file type" };
  }
  if (meta.bytes > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "File too large" };
  }
  if (meta.width > MAX_INPUT_DIM || meta.height > MAX_INPUT_DIM) {
    return { ok: false, error: "Image dimensions exceed limit" };
  }
  return { ok: true };
}
