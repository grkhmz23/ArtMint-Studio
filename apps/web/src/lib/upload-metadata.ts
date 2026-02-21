export interface UploadProvenance {
  kind: "upload";
  createdAt: string;
  appVersion?: string;
  rendererVersion?: string | null;
  original: {
    sha256: string;
    filename: string;
    mime: string;
    bytes: number;
    width: number;
    height: number;
    url: string;
  };
  mint: {
    mime: string;
    bytes: number;
    width: number;
    height: number;
    format: "webp" | "png";
    quality: number | null;
    fit: "contain" | "cover";
    maxSide: number;
    url: string;
  };
  thumbnail: {
    mime: string;
    bytes: number;
    width: number;
    height: number;
    url: string;
  };
}

export interface UploadMetadataOptions {
  name: string;
  description: string;
  symbol: string;
  imageUrl: string;
  mintMime: string;
  thumbnailUrl: string;
  originalUrl: string;
  provenance: UploadProvenance;
  externalUrl: string;
}

export function buildUploadMetadata(options: UploadMetadataOptions) {
  const {
    name,
    description,
    symbol,
    imageUrl,
    mintMime,
    thumbnailUrl,
    originalUrl,
    provenance,
    externalUrl,
  } = options;

  const attrs = [
    { trait_type: "Kind", value: "upload" },
    { trait_type: "Original SHA-256", value: provenance.original.sha256 },
    { trait_type: "Original Filename", value: provenance.original.filename },
    { trait_type: "Original MIME", value: provenance.original.mime },
    { trait_type: "Original Bytes", value: provenance.original.bytes.toString() },
    { trait_type: "Original Dimensions", value: `${provenance.original.width}x${provenance.original.height}` },
    { trait_type: "Mint MIME", value: provenance.mint.mime },
    { trait_type: "Mint Bytes", value: provenance.mint.bytes.toString() },
    { trait_type: "Mint Dimensions", value: `${provenance.mint.width}x${provenance.mint.height}` },
    { trait_type: "Mint Format", value: provenance.mint.format },
    { trait_type: "Compression Quality", value: provenance.mint.quality !== null ? provenance.mint.quality.toFixed(2) : "n/a" },
    { trait_type: "Thumbnail Dimensions", value: `${provenance.thumbnail.width}x${provenance.thumbnail.height}` },
  ];

  return {
    name,
    symbol,
    description,
    image: imageUrl,
    external_url: externalUrl,
    attributes: attrs,
    properties: {
      files: [
        { uri: imageUrl, type: mintMime },
        { uri: thumbnailUrl, type: provenance.thumbnail.mime },
        { uri: originalUrl, type: provenance.original.mime },
      ],
      category: "image",
      provenance,
    },
  };
}
