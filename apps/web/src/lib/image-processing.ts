import {
  MAX_INPUT_DIM,
  MAX_MINT_DIM,
  MAX_THUMB_DIM,
  isAllowedUploadMime,
  MAX_UPLOAD_BYTES,
} from "@/lib/upload-constants";
import { sha256Hex } from "@/lib/sha256";

export type FitMode = "contain" | "cover";
export type OutputFormat = "webp" | "png";

export interface PreparedUploadAssets {
  original: {
    sha256: string;
    filename: string;
    mime: string;
    bytes: number;
    width: number;
    height: number;
    file: File;
  };
  mint: {
    blob: Blob;
    mime: string;
    bytes: number;
    width: number;
    height: number;
    format: OutputFormat;
    quality: number | null;
    fit: FitMode;
    maxSide: number;
  };
  thumbnail: {
    blob: Blob;
    mime: string;
    bytes: number;
    width: number;
    height: number;
    maxSide: number;
  };
}

export async function prepareUploadAssets(params: {
  file: File;
  mintMaxSide: number;
  fit: FitMode;
  format: OutputFormat;
  quality: number;
}): Promise<PreparedUploadAssets> {
  const { file, mintMaxSide, fit, format, quality } = params;

  if (!isAllowedUploadMime(file.type)) {
    throw new Error("Unsupported file type");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File too large (max ${(MAX_UPLOAD_BYTES / (1024 * 1024)).toFixed(0)}MB)`);
  }
  if (mintMaxSide > MAX_MINT_DIM) {
    throw new Error("Mint size exceeds limit");
  }

  const arrayBuffer = await file.arrayBuffer();
  const sha256 = await sha256Hex(arrayBuffer);

  const image = await decodeImage(file);
  const width = image.width;
  const height = image.height;
  if (width > MAX_INPUT_DIM || height > MAX_INPUT_DIM) {
    throw new Error(`Image dimensions exceed ${MAX_INPUT_DIM}px`);
  }

  const mintSide = Math.min(mintMaxSide, Math.max(width, height));
  const thumbSide = Math.min(MAX_THUMB_DIM, Math.max(width, height));

  const mintBlob = await renderResizedBlob({
    source: image,
    size: mintSide,
    fit,
    mime: format === "png" ? "image/png" : "image/webp",
    quality: format === "png" ? undefined : quality,
  });

  const thumbBlob = await renderResizedBlob({
    source: image,
    size: thumbSide,
    fit: "contain",
    mime: "image/webp",
    quality,
  });

  return {
    original: {
      sha256,
      filename: file.name,
      mime: file.type,
      bytes: file.size,
      width,
      height,
      file,
    },
    mint: {
      blob: mintBlob,
      mime: mintBlob.type,
      bytes: mintBlob.size,
      width: mintSide,
      height: mintSide,
      format,
      quality: format === "png" ? null : quality,
      fit,
      maxSide: mintSide,
    },
    thumbnail: {
      blob: thumbBlob,
      mime: thumbBlob.type,
      bytes: thumbBlob.size,
      width: thumbSide,
      height: thumbSide,
      maxSide: thumbSide,
    },
  };
}

export async function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const image = await decodeImage(file);
  return { width: image.width, height: image.height };
}

async function decodeImage(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap !== "undefined") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fallback below
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to decode image"));
    };
    img.src = url;
  });
}

async function renderResizedBlob(params: {
  source: CanvasImageSource & { width: number; height: number };
  size: number;
  fit: FitMode;
  mime: string;
  quality?: number;
}): Promise<Blob> {
  const { source, size, fit, mime, quality } = params;

  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) {
    throw new Error("Canvas 2D context unavailable");
  }

  ctx.clearRect(0, 0, size, size);
  const { drawWidth, drawHeight, offsetX, offsetY } = computeDrawRect(
    source.width,
    source.height,
    size,
    fit
  );

  ctx.drawImage(source, offsetX, offsetY, drawWidth, drawHeight);

  return canvasToBlob(canvas, mime, quality);
}

function computeDrawRect(
  srcW: number,
  srcH: number,
  destSize: number,
  fit: FitMode
) {
  const scale = fit === "cover"
    ? Math.max(destSize / srcW, destSize / srcH)
    : Math.min(destSize / srcW, destSize / srcH);

  const drawWidth = srcW * scale;
  const drawHeight = srcH * scale;
  const offsetX = (destSize - drawWidth) / 2;
  const offsetY = (destSize - drawHeight) / 2;

  return { drawWidth, drawHeight, offsetX, offsetY };
}

function createCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function canvasToBlob(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob> {
  if ("convertToBlob" in canvas) {
    return (canvas as OffscreenCanvas).convertToBlob({ type, quality });
  }
  return new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to encode image"));
        } else {
          resolve(blob);
        }
      },
      type,
      quality
    );
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}
