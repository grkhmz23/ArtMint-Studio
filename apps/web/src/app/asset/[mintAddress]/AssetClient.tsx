"use client";

import { useState, useMemo, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, Keypair, Transaction } from "@solana/web3.js";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { fadeUp } from "@/lib/animations";
import type { CanonicalInput } from "@artmint/common";
import type { UploadProvenance } from "@/lib/upload-metadata";
import { cn } from "@/lib/utils";
import { FullscreenPreview, FullscreenButton } from "@/components/FullscreenPreview";
import { FavoriteButton } from "@/components/FavoriteButton";
import { MakeOfferButton } from "@/components/MakeOfferButton";

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

interface PreparedListing {
  serializedTransaction: string;
  saleStatePublicKey: string;
  saleStateSecretKey: string;
  blockhash: string;
  lastValidBlockHeight: number;
  estimatedFee: number;
  expiresAt: string;
}

type ListingStep = 
  | "idle"
  | "preparing"
  | "signing"
  | "submitting"
  | "confirming"
  | "success";

export function AssetClient({ mint }: { mint: MintData }) {
  const { publicKey, signTransaction } = useWallet();
  const [listPrice, setListPrice] = useState("");
  const [listingStep, setListingStep] = useState<ListingStep>("idle");
  const [listError, setListError] = useState<string | null>(null);
  const [preparedListing, setPreparedListing] = useState<PreparedListing | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

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

  /**
   * New 3-step listing flow:
   * 1. Prepare: Call API to get unsigned transaction
   * 2. Sign: Sign with wallet + saleStateKeypair, submit to chain
   * 3. Confirm: Call API to update database
   */
  const handleListBuyNow = async () => {
    if (!publicKey || !signTransaction || !listPrice) return;
    
    const priceLamports = Math.floor(parseFloat(listPrice) * 1e9);
    if (isNaN(priceLamports) || priceLamports <= 0) {
      setListError("Enter a valid price in SOL");
      return;
    }

    setListError(null);
    
    try {
      // Step 1: Prepare the listing transaction
      setListingStep("preparing");
      const prepareRes = await fetch("/api/listing/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mintAddress: mint.mintAddress,
          priceLamports: priceLamports.toString(),
        }),
      });

      if (!prepareRes.ok) {
        const err = await prepareRes.json();
        throw new Error(err.error ?? "Failed to prepare listing");
      }

      const prepareData = await prepareRes.json();
      const prepared: PreparedListing = prepareData.prepared;
      setPreparedListing(prepared);

      // Step 2: Sign the transaction
      setListingStep("signing");
      
      // Deserialize the transaction
      const transactionBuffer = Buffer.from(prepared.serializedTransaction, "base64");
      const transaction = Transaction.from(transactionBuffer);

      // Sign with the user's wallet
      const signedTx = await signTransaction(transaction);
      
      // Step 3: Submit to blockchain
      setListingStep("submitting");
      
      const cluster = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet").toLowerCase();
      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? (
        cluster === "mainnet-beta" || cluster === "mainnet"
          ? "https://api.mainnet-beta.solana.com"
          : "https://api.devnet.solana.com"
      );
      
      const connection = new Connection(rpcUrl, "confirmed");
      
      // Send the signed transaction
      const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
      
      setTxSignature(signature);

      // Step 4: Wait for confirmation
      setListingStep("confirming");
      
      // Poll for confirmation (max 60 seconds)
      const confirmed = await Promise.race([
        connection.confirmTransaction(
          {
            signature,
            blockhash: prepared.blockhash,
            lastValidBlockHeight: prepared.lastValidBlockHeight,
          },
          "confirmed"
        ),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("Confirmation timeout")), 60000)
        ),
      ]);

      if (confirmed.value.err) {
        throw new Error("Transaction failed on-chain");
      }

      // Step 5: Confirm with backend
      const confirmRes = await fetch("/api/listing/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mintAddress: mint.mintAddress,
          txSignature: signature,
          saleStateKey: prepared.saleStatePublicKey,
        }),
      });

      if (!confirmRes.ok) {
        const err = await confirmRes.json();
        // If it's a 202 (Accepted), the tx is still processing
        if (confirmRes.status === 202) {
          setListingStep("success");
          // Reload after a delay to show the listing
          setTimeout(() => window.location.reload(), 3000);
          return;
        }
        throw new Error(err.error ?? "Failed to confirm listing");
      }

      setListingStep("success");
      
      // Reload to show updated state
      setTimeout(() => window.location.reload(), 2000);
      
    } catch (err) {
      console.error("Listing error:", err);
      setListError(err instanceof Error ? err.message : "Listing failed");
      setListingStep("idle");
    }
  };

  const getExplorerUrl = (signature: string) => {
    const cluster = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet").toLowerCase();
    const clusterParam = cluster === "mainnet-beta" || cluster === "mainnet" 
      ? "" 
      : `?cluster=${cluster}`;
    return `https://explorer.solana.com/tx/${signature}${clusterParam}`;
  };

  const getListingStatusMessage = () => {
    switch (listingStep) {
      case "preparing":
        return "Preparing transaction...";
      case "signing":
        return "Sign in your wallet...";
      case "submitting":
        return "Submitting to blockchain...";
      case "confirming":
        return "Waiting for confirmation...";
      case "success":
        return "Listed successfully!";
      default:
        return "List Asset";
    }
  };

  const isListingInProgress = listingStep !== "idle" && listingStep !== "success";
  const isListed = mint.listing?.status === "active";

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
              {/* Overlay Controls */}
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <FavoriteButton 
                  mintAddress={mint.mintAddress}
                  size="md"
                />
                <FullscreenButton onClick={() => setFullscreenOpen(true)} />
              </div>

              <div className="absolute bottom-4 left-6 right-6 flex justify-between items-end">
                <span className="font-serif text-2xl italic text-white/50">
                  {mint.title ?? (isUpload ? "ArtMint Upload" : `ArtMint #${canonicalInput?.seed ?? ""}`)}
                </span>
                <span className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest">
                  1/1 Edition
                </span>
              </div>
            </motion.div>

            {/* Fullscreen Preview */}
            <FullscreenPreview
              imageUrl={mint.imageUrl}
              title={mint.title ?? undefined}
              isOpen={fullscreenOpen}
              onClose={() => setFullscreenOpen(false)}
            />
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
              {isListed ? (
                <div className="border border-[var(--success)] p-6 bg-[var(--success)]/5">
                  <div className="font-mono text-[10px] text-[var(--success)] uppercase tracking-widest mb-2 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-[var(--success)] rounded-full" />
                    {mint.listing!.status}
                  </div>
                  <div className="font-serif text-4xl text-white mb-6">
                    {(Number(mint.listing!.priceLamports) / 1e9).toFixed(2)} SOL
                  </div>
                  {mint.listing!.txSignature && (
                    <a
                      href={getExplorerUrl(mint.listing!.txSignature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] text-[var(--accent)] hover:underline block mb-2"
                    >
                      View on Explorer →
                    </a>
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
                      disabled={isListingInProgress}
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
                    disabled={isListingInProgress || !publicKey || !listPrice || listingStep === "success"}
                  >
                    {getListingStatusMessage()}
                  </Button>
                  
                  {/* Transaction progress indicator */}
                  {isListingInProgress && (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          listingStep === "preparing" ? "bg-[var(--accent)] animate-pulse" : "bg-[var(--success)]"
                        )} />
                        <span className="font-mono text-[10px] text-[var(--text-dim)]">Prepare transaction</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          listingStep === "signing" ? "bg-[var(--accent)] animate-pulse" :
                          listingStep === "preparing" ? "bg-[var(--border)]" : "bg-[var(--success)]"
                        )} />
                        <span className="font-mono text-[10px] text-[var(--text-dim)]">Sign with wallet</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          listingStep === "submitting" ? "bg-[var(--accent)] animate-pulse" :
                          ["preparing", "signing"].includes(listingStep) ? "bg-[var(--border)]" : "bg-[var(--success)]"
                        )} />
                        <span className="font-mono text-[10px] text-[var(--text-dim)]">Submit to blockchain</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          listingStep === "confirming" ? "bg-[var(--accent)] animate-pulse" : "bg-[var(--border)]"
                        )} />
                        <span className="font-mono text-[10px] text-[var(--text-dim)]">Confirm listing</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Success message with explorer link */}
                  {/* Make Offer Button - only show if not listed and not owner */}
                  {!isListed && publicKey?.toBase58() !== mint.wallet && (
                    <div className="mt-4 pt-4 border-t border-[var(--border)]">
                      <MakeOfferButton
                        mintAddress={mint.mintAddress}
                        sellerWallet={mint.wallet}
                      />
                    </div>
                  )}

                  {listingStep === "success" && txSignature && (
                    <div className="mt-4 p-3 border border-[var(--success)] bg-[var(--success)]/5">
                      <p className="font-mono text-[10px] text-[var(--success)] mb-2">
                        ✓ Listed successfully!
                      </p>
                      <a
                        href={getExplorerUrl(txSignature)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[10px] text-[var(--accent)] hover:underline"
                      >
                        View transaction on Explorer →
                      </a>
                    </div>
                  )}
                  
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
