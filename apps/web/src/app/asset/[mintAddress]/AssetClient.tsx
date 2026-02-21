"use client";

import { useState, useMemo, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { fadeUp } from "@/lib/animations";
import type { CanonicalInput } from "@artmint/common";
import type { UploadProvenance } from "@/lib/upload-metadata";
import { cn } from "@/lib/utils";

interface MintData {
  id: string;
  mintAddress: string;
  inputJson: string;
  hash: string;
  imageUrl: string;
  animationUrl: string;
  metadataUrl: string;
  title: string | null;
  wallet: string;
  createdAt: Date;
  listing: {
    id: string;
    mintAddress: string;
    priceLamports: string;
    status: string;
    txSignature: string | null;
    saleStateKey: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}

export function AssetClient({ mint }: { mint: MintData }) {
  const { publicKey } = useWallet();
  const [listPrice, setListPrice] = useState("");
  const [listing, setListing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [exporting, setExporting] = useState(false);

  const parsedInput = useMemo(() => {
    try {
      return JSON.parse(mint.inputJson) as CanonicalInput | UploadProvenance;
    } catch {
      return null;
    }
  }, [mint.inputJson]);

  const isUpload = !!parsedInput && (parsedInput as UploadProvenance).kind === "upload";
  const canonicalInput = !isUpload ? (parsedInput as CanonicalInput | null) : null;
  const uploadInput = isUpload ? (parsedInput as UploadProvenance) : null;

  const handleCopyParams = async () => {
    await navigator.clipboard.writeText(mint.inputJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport4K = useCallback(async () => {
    if (!canonicalInput) return;
    setExporting(true);
    try {
      const params = encodeURIComponent(
        JSON.stringify({
          templateId: canonicalInput.templateId,
          seed: canonicalInput.seed,
          palette: canonicalInput.palette,
          params: canonicalInput.params,
          format: "svg",
        })
      );
      const res = await fetch(`/api/render?data=${params}`);
      if (!res.ok) throw new Error("Failed to fetch SVG");
      const svgText = await res.text();
      const SIZE = 3840;
      const blob = new Blob([svgText], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setExporting(false);
          return;
        }
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        URL.revokeObjectURL(url);
        canvas.toBlob(
          (pngBlob) => {
            if (!pngBlob) {
              setExporting(false);
              return;
            }
            const a = document.createElement("a");
            a.href = URL.createObjectURL(pngBlob);
            a.download = `artmint-${canonicalInput.templateId}-${canonicalInput.seed}-4K.png`;
            a.click();
            URL.revokeObjectURL(a.href);
            setExporting(false);
          },
          "image/png"
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        setExporting(false);
      };
      img.src = url;
    } catch {
      setExporting(false);
    }
  }, [canonicalInput]);

  const handleRerender4K = () => {
    window.open(mint.animationUrl, "_blank");
  };

  const handleListBuyNow = async () => {
    if (!publicKey || !listPrice) return;
    const priceLamports = Math.floor(parseFloat(listPrice) * 1e9);
    if (isNaN(priceLamports) || priceLamports <= 0) {
      setListError("Enter a valid price in SOL");
      return;
    }
    setListing(true);
    setListError(null);
    try {
      const res = await fetch("/api/listing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mintAddress: mint.mintAddress,
          priceLamports: priceLamports.toString(),
          status: "active",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Listing failed");
      }
      window.location.reload();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Listing failed");
    } finally {
      setListing(false);
    }
  };

  const provenanceRows = isUpload
    ? [
        { label: "Kind", value: "upload" },
        { label: "Original SHA-256", value: uploadInput?.original.sha256 ?? "---" },
        { label: "Original File", value: uploadInput?.original.filename ?? "---" },
        { label: "Original MIME", value: uploadInput?.original.mime ?? "---" },
      ]
    : [
        { label: "Algorithm", value: canonicalInput?.templateId ?? "---" },
        { label: "Seed Config", value: String(canonicalInput?.seed ?? "---") },
        { label: "Core Engine", value: canonicalInput?.rendererVersion ?? "---" },
        { label: "Tx Hash", value: mint.hash.slice(0, 8) + "..." + mint.hash.slice(-4) },
      ];

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="noise-overlay" />

      <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-12">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 items-center lg:items-start">
          {/* Artwork Display */}
          <div className="flex-1 w-full max-w-[800px]">
            {/* View toggle */}
            {!isUpload && (
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setShowLive(false)}
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-widest px-4 py-2 border transition-colors",
                    !showLive
                      ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5"
                      : "border-[var(--border)] text-[var(--text-dim)] hover:text-white"
                  )}
                >
                  Static
                </button>
                <button
                  onClick={() => setShowLive(true)}
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-widest px-4 py-2 border transition-colors",
                    showLive
                      ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5"
                      : "border-[var(--border)] text-[var(--text-dim)] hover:text-white"
                  )}
                >
                  Live Render
                </button>
              </div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="aspect-square bg-black border border-[var(--border)] relative p-2 md:p-6 pb-12 md:pb-20"
            >
              {!isUpload && showLive ? (
                <iframe
                  src={mint.animationUrl}
                  sandbox="allow-scripts"
                  className="w-full h-full border-none"
                  title="Live render"
                />
              ) : (
                <img
                  src={mint.imageUrl}
                  alt={mint.title ?? "Artwork"}
                  className="w-full h-full object-cover shadow-2xl"
                />
              )}
              <div className="absolute bottom-4 left-6 right-6 flex justify-between items-end">
                <span className="font-serif text-2xl italic text-white/50">
                  {mint.title ?? (isUpload ? "ArtMint Upload" : `ArtMint #${canonicalInput?.seed ?? ""}`)}
                </span>
                <span className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest">
                  1/1 Edition
                </span>
              </div>
            </motion.div>
          </div>

          {/* Info & Actions */}
          <div className="w-full lg:w-[400px] shrink-0 space-y-12">
            <motion.div
              initial="hidden"
              animate="show"
              variants={fadeUp}
              className="border-b border-[var(--border)] pb-8"
            >
              <h1 className="font-serif text-5xl text-white mb-4">
                {mint.title ?? (isUpload ? "ArtMint Upload" : `ArtMint #${canonicalInput?.seed ?? ""}`)}
              </h1>
              <p className="font-mono text-xs text-[var(--accent)] uppercase tracking-widest bg-[var(--accent)]/10 px-3 py-1 inline-block border border-[var(--accent)]">
                Address: {mint.mintAddress.slice(0, 6)}...{mint.mintAddress.slice(-4)}
              </p>
            </motion.div>

            {/* Provenance */}
            <motion.div
              initial="hidden"
              animate="show"
              variants={fadeUp}
              className="space-y-6 font-mono text-xs uppercase tracking-widest"
            >
              <h3 className="text-[10px] text-[var(--text-dim)] border-b border-[var(--border)] pb-2">
                Provenance Metadata
              </h3>
              <div className="space-y-4">
                {provenanceRows.map((row, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-end border-b border-[var(--border)]/30 pb-1"
                  >
                    <span className="text-[var(--text-dim)]">{row.label}</span>
                    <span className="text-white text-right">{row.value}</span>
                  </div>
                ))}
              </div>
              {isUpload && uploadInput && (
                <div className="space-y-3">
                  <div className="flex justify-between border-b border-[var(--border)]/30 pb-1">
                    <span className="text-[var(--text-dim)]">Original Size</span>
                    <span className="text-white">
                      {uploadInput.original.width}x{uploadInput.original.height}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[var(--border)]/30 pb-1">
                    <span className="text-[var(--text-dim)]">Original Bytes</span>
                    <span className="text-white">{uploadInput.original.bytes}</span>
                  </div>
                  <div className="flex justify-between border-b border-[var(--border)]/30 pb-1">
                    <span className="text-[var(--text-dim)]">Mint Format</span>
                    <span className="text-white">{uploadInput.mint.format}</span>
                  </div>
                  <div className="flex justify-between border-b border-[var(--border)]/30 pb-1">
                    <span className="text-[var(--text-dim)]">Mint MIME</span>
                    <span className="text-white">{uploadInput.mint.mime}</span>
                  </div>
                  <div className="flex justify-between border-b border-[var(--border)]/30 pb-1">
                    <span className="text-[var(--text-dim)]">Mint Size</span>
                    <span className="text-white">
                      {uploadInput.mint.width}x{uploadInput.mint.height}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[var(--border)]/30 pb-1">
                    <span className="text-[var(--text-dim)]">Mint Bytes</span>
                    <span className="text-white">{uploadInput.mint.bytes}</span>
                  </div>
                  <div className="flex justify-between border-b border-[var(--border)]/30 pb-1">
                    <span className="text-[var(--text-dim)]">Compression</span>
                    <span className="text-white">
                      {uploadInput.mint.quality !== null ? uploadInput.mint.quality.toFixed(2) : "lossless"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[var(--border)]/30 pb-1">
                    <span className="text-[var(--text-dim)]">Thumbnail</span>
                    <span className="text-white">
                      {uploadInput.thumbnail.width}x{uploadInput.thumbnail.height}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[var(--border)]/30 pb-1">
                    <span className="text-[var(--text-dim)]">App Version</span>
                    <span className="text-white">{uploadInput.appVersion ?? "---"}</span>
                  </div>
                  <div className="flex justify-between border-b border-[var(--border)]/30 pb-1">
                    <span className="text-[var(--text-dim)]">Renderer</span>
                    <span className="text-white">{uploadInput.rendererVersion ?? "---"}</span>
                  </div>
                </div>
              )}
              {uploadInput && (
                <div className="space-y-2 pt-4">
                  <a
                    href={uploadInput.original.url}
                    download
                    className="block border border-[var(--border)] px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] hover:text-white hover:border-white transition-colors"
                  >
                    Download Original
                  </a>
                  <a
                    href={uploadInput.mint.url}
                    download
                    className="block border border-[var(--border)] px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] hover:text-white hover:border-white transition-colors"
                  >
                    Download Mint Image
                  </a>
                  <a
                    href={uploadInput.thumbnail.url}
                    download
                    className="block border border-[var(--border)] px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] hover:text-white hover:border-white transition-colors"
                  >
                    Download Thumbnail
                  </a>
                </div>
              )}
              {!isUpload && canonicalInput?.palette && (
                <div>
                  <span className="text-[10px] text-[var(--text-dim)] block mb-2">
                    Palette
                  </span>
                  <div className="flex gap-1 h-6 border border-[var(--border)] p-0.5">
                    {canonicalInput.palette.map((c, i) => (
                      <div
                        key={i}
                        className="flex-1 h-full"
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Listing */}
            <motion.div initial="hidden" animate="show" variants={fadeUp} className="space-y-4 pt-4">
              {mint.listing ? (
                <div className="border border-[var(--success)] p-6 bg-[var(--success)]/5">
                  <div className="font-mono text-[10px] text-[var(--success)] uppercase tracking-widest mb-2 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-[var(--success)] rounded-full" />
                    {mint.listing.status}
                  </div>
                  <div className="font-serif text-4xl text-white mb-6">
                    {(Number(mint.listing.priceLamports) / 1e9).toFixed(2)} SOL
                  </div>
                  {mint.listing.txSignature && (
                    <div className="font-mono text-[10px] text-[var(--text-dim)] mb-4">
                      TX: {mint.listing.txSignature}
                    </div>
                  )}
                </div>
              ) : (
                <div className="border border-[var(--border)] p-6">
                  <label className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest block mb-4">
                    Initialize Listing
                  </label>
                  <div className="flex gap-2 mb-6">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={listPrice}
                      onChange={(e) => setListPrice(e.target.value)}
                      className="text-xl text-center"
                    />
                    <div className="border border-[var(--border)] flex items-center px-4 font-mono text-xs uppercase tracking-widest shrink-0">
                      SOL
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleListBuyNow}
                    disabled={listing || !publicKey || !listPrice}
                  >
                    {listing ? "Listing..." : "List Asset"}
                  </Button>
                  {listError && (
                    <div className="font-mono text-[10px] text-[var(--danger)] mt-2">
                      {listError}
                    </div>
                  )}
                  {!publicKey && (
                    <div className="font-mono text-[10px] text-[var(--text-dim)] mt-2">
                      Connect wallet to list
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            {/* Action buttons */}
            <motion.div initial="hidden" animate="show" variants={fadeUp} className="flex gap-4">
              {!isUpload && (
                <button
                  onClick={handleExport4K}
                  disabled={exporting}
                  className="flex-1 border border-[var(--border)] py-3 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] hover:text-white hover:border-white transition-colors disabled:opacity-50"
                >
                  {exporting ? "Exporting..." : "Download 4K"}
                </button>
              )}
              <button
                onClick={handleCopyParams}
                className="flex-1 border border-[var(--border)] py-3 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] hover:text-white hover:border-white transition-colors"
              >
                {copied ? "Copied!" : isUpload ? "Copy Provenance" : "Extract Source"}
              </button>
              {!isUpload && (
                <button
                  onClick={handleRerender4K}
                  className="flex-1 border border-[var(--border)] py-3 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] hover:text-white hover:border-white transition-colors"
                >
                  Open Artifact
                </button>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
