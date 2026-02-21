"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UploadDropzone } from "@/components/upload/UploadDropzone";
import { OptimizationSettings } from "@/components/upload/OptimizationSettings";
import { useAuth } from "@/lib/use-auth";
import { sanitizeFilename } from "@/lib/filename";
import {
  formatBytes,
  prepareUploadAssets,
  readImageDimensions,
  PreparedUploadAssets,
} from "@/lib/image-processing";
import {
  MAX_INPUT_DIM,
  MAX_UPLOAD_BYTES,
  isAllowedUploadMime,
} from "@/lib/upload-constants";

export default function UploadPage() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const { authenticated, signingIn, signIn } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalDims, setOriginalDims] = useState<{ width: number; height: number } | null>(null);

  const [mintMaxSide, setMintMaxSide] = useState(4096);
  const [fit, setFit] = useState<"contain" | "cover">("contain");
  const [format, setFormat] = useState<"webp" | "png">("webp");
  const [quality, setQuality] = useState(0.85);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [prepared, setPrepared] = useState<PreparedUploadAssets | null>(null);
  const [mintPreviewUrl, setMintPreviewUrl] = useState<string | null>(null);
  const [thumbPreviewUrl, setThumbPreviewUrl] = useState<string | null>(null);

  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      setOriginalDims(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    readImageDimensions(file)
      .then((dims) => setOriginalDims(dims))
      .catch(() => setOriginalDims(null));

    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    setPrepared(null);
    setMintPreviewUrl(null);
    setThumbPreviewUrl(null);
  }, [file, mintMaxSide, fit, format, quality]);

  useEffect(() => {
    if (!mintPreviewUrl) return;
    return () => URL.revokeObjectURL(mintPreviewUrl);
  }, [mintPreviewUrl]);

  useEffect(() => {
    if (!thumbPreviewUrl) return;
    return () => URL.revokeObjectURL(thumbPreviewUrl);
  }, [thumbPreviewUrl]);

  const canPrepare = useMemo(() => {
    return !!file && !processing;
  }, [file, processing]);

  const needsWallet = !publicKey;
  const needsAuth = publicKey && !authenticated;

  const handlePrepare = async () => {
    if (!file) return;
    setError(null);

    if (!isAllowedUploadMime(file.type)) {
      setError("Unsupported file type. Use PNG, JPG, WebP (GIF optional).");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`File too large (max ${(MAX_UPLOAD_BYTES / (1024 * 1024)).toFixed(0)}MB)`);
      return;
    }
    if (originalDims) {
      if (originalDims.width > MAX_INPUT_DIM || originalDims.height > MAX_INPUT_DIM) {
        setError(`Image dimensions exceed ${MAX_INPUT_DIM}px`);
        return;
      }
    }

    setProcessing(true);
    try {
      const preparedAssets = await prepareUploadAssets({
        file,
        mintMaxSide,
        fit,
        format,
        quality,
      });

      setPrepared(preparedAssets);
      setMintPreviewUrl(URL.createObjectURL(preparedAssets.mint.blob));
      setThumbPreviewUrl(URL.createObjectURL(preparedAssets.thumbnail.blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to prepare upload");
    } finally {
      setProcessing(false);
    }
  };

  const handleMint = async () => {
    if (!file || !prepared) return;
    if (!publicKey) {
      setError("Connect your wallet first");
      return;
    }
    if (!authenticated) {
      await signIn();
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const safeName = sanitizeFilename(file.name) || "upload";
      const form = new FormData();
      form.append("original", file, safeName);
      form.append("mint", prepared.mint.blob, `mint.${prepared.mint.format}`);
      form.append("thumbnail", prepared.thumbnail.blob, "thumb.webp");

      const meta = {
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        original: {
          filename: safeName,
          mime: prepared.original.mime,
          bytes: prepared.original.bytes,
          width: prepared.original.width,
          height: prepared.original.height,
          sha256: prepared.original.sha256,
        },
        mint: {
          mime: prepared.mint.mime,
          bytes: prepared.mint.bytes,
          width: prepared.mint.width,
          height: prepared.mint.height,
          maxSide: prepared.mint.maxSide,
          fit: prepared.mint.fit,
          format: prepared.mint.format,
          quality: prepared.mint.quality ?? undefined,
        },
        thumbnail: {
          mime: prepared.thumbnail.mime,
          bytes: prepared.thumbnail.bytes,
          width: prepared.thumbnail.width,
          height: prepared.thumbnail.height,
          maxSide: prepared.thumbnail.maxSide,
        },
        createdAt: new Date().toISOString(),
        appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown",
      };

      form.append("meta", JSON.stringify(meta));

      const res = await fetch("/api/upload/commit", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Upload mint failed");
      }

      const data = await res.json();
      router.push(`/asset/${data.placeholderMintAddress}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload mint failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="noise-overlay" />

      <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-12 space-y-10">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-6">
            <div className="border border-[var(--border)] p-6">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-3">
                Upload Artwork
              </div>
              <UploadDropzone file={file} onFile={setFile} disabled={processing || uploading} />
            </div>

            {file && (
              <div className="border border-[var(--border)] p-6 space-y-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
                  Original Preview
                </div>
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Original preview"
                    className="w-full max-h-[420px] object-contain border border-[var(--border)]"
                  />
                )}
                <div className="font-mono text-[11px] text-[var(--text)] space-y-2">
                  <div className="flex justify-between border-b border-[var(--border)]/40 pb-1">
                    <span className="text-[var(--text-dim)]">Type</span>
                    <span>{file.type || "unknown"}</span>
                  </div>
                  <div className="flex justify-between border-b border-[var(--border)]/40 pb-1">
                    <span className="text-[var(--text-dim)]">Size</span>
                    <span>{formatBytes(file.size)}</span>
                  </div>
                  <div className="flex justify-between border-b border-[var(--border)]/40 pb-1">
                    <span className="text-[var(--text-dim)]">Dimensions</span>
                    <span>
                      {originalDims ? `${originalDims.width}x${originalDims.height}` : "..."}
                    </span>
                  </div>
                </div>
                <div className="text-[10px] text-[var(--text-dim)] font-mono uppercase tracking-widest">
                  We keep your original file for provenance + download.
                </div>
              </div>
            )}
          </div>

          <div className="w-full lg:w-[420px] shrink-0 space-y-6">
            <div className="border border-[var(--border)] p-6 space-y-6">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
                Optimization Settings
              </div>
              <OptimizationSettings
                mintMaxSide={mintMaxSide}
                fit={fit}
                format={format}
                quality={quality}
                onChange={(next) => {
                  if (next.mintMaxSide) setMintMaxSide(next.mintMaxSide);
                  if (next.fit) setFit(next.fit);
                  if (next.format) setFormat(next.format);
                  if (next.quality) setQuality(next.quality);
                }}
              />
              <div className="text-[10px] text-[var(--text-dim)] font-mono uppercase tracking-widest">
                Outputs are re-encoded to strip metadata. Originals are preserved.
              </div>
            </div>

            <div className="border border-[var(--border)] p-6 space-y-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
                Metadata
              </div>
              <Input
                placeholder="Title (optional)"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <Input
                placeholder="Description (optional)"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className="border border-[var(--border)] p-6 space-y-4">
              <Button
                className="w-full"
                onClick={handlePrepare}
                disabled={!canPrepare}
              >
                {processing ? "Preparing..." : "Prepare for Mint"}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleMint}
                disabled={!prepared || uploading || needsWallet}
              >
                {uploading ? "Minting..." : needsAuth ? "Sign In to Mint" : "Mint"}
              </Button>
              {needsWallet && (
                <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)]">
                  Connect your wallet to mint.
                </div>
              )}
              {needsAuth && (
                <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)]">
                  {signingIn ? "Signing in..." : "Sign in with Solana to mint."}
                </div>
              )}
              {error && (
                <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--danger)]">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>

        {prepared && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="border border-[var(--border)] p-6 space-y-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
                Mint Image Preview
              </div>
              {mintPreviewUrl && (
                <img
                  src={mintPreviewUrl}
                  alt="Mint preview"
                  className="w-full max-h-[420px] object-contain border border-[var(--border)]"
                />
              )}
              <div className="font-mono text-[11px] text-[var(--text)] space-y-2">
                <div className="flex justify-between border-b border-[var(--border)]/40 pb-1">
                  <span className="text-[var(--text-dim)]">Format</span>
                  <span>{prepared.mint.format.toUpperCase()}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)]/40 pb-1">
                  <span className="text-[var(--text-dim)]">Dimensions</span>
                  <span>{prepared.mint.width}x{prepared.mint.height}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)]/40 pb-1">
                  <span className="text-[var(--text-dim)]">Estimated Size</span>
                  <span>{formatBytes(prepared.mint.bytes)}</span>
                </div>
              </div>
            </div>

            <div className="border border-[var(--border)] p-6 space-y-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
                Thumbnail Preview
              </div>
              {thumbPreviewUrl && (
                <img
                  src={thumbPreviewUrl}
                  alt="Thumbnail preview"
                  className="w-full max-h-[240px] object-contain border border-[var(--border)]"
                />
              )}
              <div className="font-mono text-[11px] text-[var(--text)] space-y-2">
                <div className="flex justify-between border-b border-[var(--border)]/40 pb-1">
                  <span className="text-[var(--text-dim)]">Format</span>
                  <span>WEBP</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)]/40 pb-1">
                  <span className="text-[var(--text-dim)]">Dimensions</span>
                  <span>{prepared.thumbnail.width}x{prepared.thumbnail.height}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)]/40 pb-1">
                  <span className="text-[var(--text-dim)]">Estimated Size</span>
                  <span>{formatBytes(prepared.thumbnail.bytes)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
