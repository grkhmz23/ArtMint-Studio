import { describe, expect, it } from "vitest";
import { getImageDimensionsFromBuffer } from "../lib/image-dimensions";

function pngBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(24);
  Buffer.from("89504e470d0a1a0a", "hex").copy(buf, 0);
  buf.writeUInt32BE(13, 8); // IHDR length
  buf.write("IHDR", 12, 4, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

function gifBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(10);
  buf.write("GIF89a", 0, 6, "ascii");
  buf.writeUInt16LE(width, 6);
  buf.writeUInt16LE(height, 8);
  return buf;
}

function jpegBuffer(width: number, height: number): Buffer {
  const app0 = Buffer.from([
    0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00,
    0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01,
    0x00, 0x00, // Xthumbnail, Ythumbnail
  ]);
  const sof0 = Buffer.alloc(2 + 2 + 15);
  let o = 0;
  sof0[o++] = 0xff;
  sof0[o++] = 0xc0;
  sof0.writeUInt16BE(17, o); o += 2;
  sof0[o++] = 8; // precision
  sof0.writeUInt16BE(height, o); o += 2;
  sof0.writeUInt16BE(width, o); o += 2;
  sof0[o++] = 3; // components
  sof0[o++] = 1; sof0[o++] = 0x11; sof0[o++] = 0;
  sof0[o++] = 2; sof0[o++] = 0x11; sof0[o++] = 0;
  sof0[o++] = 3; sof0[o++] = 0x11; sof0[o++] = 0;

  return Buffer.concat([
    Buffer.from([0xff, 0xd8]), // SOI
    app0,
    sof0,
    Buffer.from([0xff, 0xd9]), // EOI
  ]);
}

function webpVp8xBuffer(width: number, height: number): Buffer {
  const payload = Buffer.alloc(10);
  // flags(1) + reserved(3) default zero
  const w = width - 1;
  const h = height - 1;
  payload[4] = w & 0xff;
  payload[5] = (w >> 8) & 0xff;
  payload[6] = (w >> 16) & 0xff;
  payload[7] = h & 0xff;
  payload[8] = (h >> 8) & 0xff;
  payload[9] = (h >> 16) & 0xff;

  const chunkHeader = Buffer.alloc(8);
  chunkHeader.write("VP8X", 0, 4, "ascii");
  chunkHeader.writeUInt32LE(payload.length, 4);

  const totalLen = 12 + chunkHeader.length + payload.length;
  const riffSize = totalLen - 8;
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, 4, "ascii");
  header.writeUInt32LE(riffSize, 4);
  header.write("WEBP", 8, 4, "ascii");

  return Buffer.concat([header, chunkHeader, payload]);
}

describe("image-dimensions parser", () => {
  it("reads PNG dimensions", () => {
    expect(getImageDimensionsFromBuffer(pngBuffer(640, 480), "image/png")).toEqual({
      width: 640,
      height: 480,
    });
  });

  it("reads GIF dimensions", () => {
    expect(getImageDimensionsFromBuffer(gifBuffer(320, 240), "image/gif")).toEqual({
      width: 320,
      height: 240,
    });
  });

  it("reads JPEG dimensions", () => {
    expect(getImageDimensionsFromBuffer(jpegBuffer(800, 600), "image/jpeg")).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("reads WebP VP8X dimensions", () => {
    expect(getImageDimensionsFromBuffer(webpVp8xBuffer(1024, 1024), "image/webp")).toEqual({
      width: 1024,
      height: 1024,
    });
  });

  it("rejects unsupported mime", () => {
    expect(() =>
      getImageDimensionsFromBuffer(Buffer.alloc(8), "image/bmp")
    ).toThrow(/Unsupported image mime/);
  });
});
