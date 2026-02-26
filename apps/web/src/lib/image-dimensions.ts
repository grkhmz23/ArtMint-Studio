export interface ImageDimensions {
  width: number;
  height: number;
}

function requireBytes(buf: Buffer, min: number): void {
  if (buf.length < min) {
    throw new Error("Image file is truncated");
  }
}

function readUInt24LE(buf: Buffer, offset: number): number {
  return buf[offset]! | (buf[offset + 1]! << 8) | (buf[offset + 2]! << 16);
}

function parsePngDimensions(buf: Buffer): ImageDimensions {
  requireBytes(buf, 24);
  const pngSig = "89504e470d0a1a0a";
  if (buf.subarray(0, 8).toString("hex") !== pngSig) {
    throw new Error("Invalid PNG signature");
  }
  if (buf.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error("PNG IHDR chunk not found");
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

function parseGifDimensions(buf: Buffer): ImageDimensions {
  requireBytes(buf, 10);
  const header = buf.subarray(0, 6).toString("ascii");
  if (header !== "GIF87a" && header !== "GIF89a") {
    throw new Error("Invalid GIF header");
  }
  return {
    width: buf.readUInt16LE(6),
    height: buf.readUInt16LE(8),
  };
}

function parseJpegDimensions(buf: Buffer): ImageDimensions {
  requireBytes(buf, 4);
  if (buf[0] !== 0xff || buf[1] !== 0xd8) {
    throw new Error("Invalid JPEG SOI marker");
  }

  let offset = 2;
  while (offset + 3 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset++;
      continue;
    }

    // Skip fill bytes
    while (offset < buf.length && buf[offset] === 0xff) {
      offset++;
    }
    if (offset >= buf.length) break;

    const marker = buf[offset]!;
    offset++;

    // Standalone markers without segment length
    if (
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd9)
    ) {
      continue;
    }

    if (offset + 1 >= buf.length) break;
    const segmentLength = buf.readUInt16BE(offset);
    if (segmentLength < 2) {
      throw new Error("Invalid JPEG segment length");
    }
    const segmentStart = offset + 2;
    const segmentEnd = offset + segmentLength;
    if (segmentEnd > buf.length) {
      throw new Error("JPEG segment exceeds file length");
    }

    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isSof) {
      if (segmentLength < 7) {
        throw new Error("JPEG SOF segment too short");
      }
      const height = buf.readUInt16BE(segmentStart + 1);
      const width = buf.readUInt16BE(segmentStart + 3);
      return { width, height };
    }

    offset = segmentEnd;
  }

  throw new Error("JPEG dimensions not found");
}

function parseWebpDimensions(buf: Buffer): ImageDimensions {
  requireBytes(buf, 16);
  if (buf.subarray(0, 4).toString("ascii") !== "RIFF") {
    throw new Error("Invalid WebP RIFF header");
  }
  if (buf.subarray(8, 12).toString("ascii") !== "WEBP") {
    throw new Error("Invalid WebP signature");
  }

  let offset = 12;
  while (offset + 8 <= buf.length) {
    const fourcc = buf.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = buf.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    const paddedChunkSize = chunkSize + (chunkSize % 2);
    const nextOffset = dataOffset + paddedChunkSize;

    if (nextOffset > buf.length) {
      throw new Error("WebP chunk exceeds file length");
    }

    if (fourcc === "VP8X") {
      requireBytes(buf, dataOffset + 10);
      const width = 1 + readUInt24LE(buf, dataOffset + 4);
      const height = 1 + readUInt24LE(buf, dataOffset + 7);
      return { width, height };
    }

    if (fourcc === "VP8L") {
      requireBytes(buf, dataOffset + 5);
      if (buf[dataOffset] !== 0x2f) {
        throw new Error("Invalid WebP VP8L signature");
      }
      const width = 1 + (((buf[dataOffset + 1]! | (buf[dataOffset + 2]! << 8)) & 0x3fff));
      const height =
        1 + ((((buf[dataOffset + 2]! | (buf[dataOffset + 3]! << 8) | (buf[dataOffset + 4]! << 16)) >> 6) & 0x3fff));
      return { width, height };
    }

    if (fourcc === "VP8 ") {
      requireBytes(buf, dataOffset + 10);
      if (
        buf[dataOffset + 3] !== 0x9d ||
        buf[dataOffset + 4] !== 0x01 ||
        buf[dataOffset + 5] !== 0x2a
      ) {
        throw new Error("Invalid WebP VP8 frame header");
      }
      const width = buf.readUInt16LE(dataOffset + 6) & 0x3fff;
      const height = buf.readUInt16LE(dataOffset + 8) & 0x3fff;
      return { width, height };
    }

    offset = nextOffset;
  }

  throw new Error("WebP dimensions not found");
}

export function getImageDimensionsFromBuffer(
  buf: Buffer,
  mime: string
): ImageDimensions {
  switch (mime.toLowerCase()) {
    case "image/png":
      return parsePngDimensions(buf);
    case "image/jpeg":
    case "image/jpg":
      return parseJpegDimensions(buf);
    case "image/webp":
      return parseWebpDimensions(buf);
    case "image/gif":
      return parseGifDimensions(buf);
    default:
      throw new Error(`Unsupported image mime: ${mime}`);
  }
}
