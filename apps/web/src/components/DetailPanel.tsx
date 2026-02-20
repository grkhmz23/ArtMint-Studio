"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Variation } from "@artmint/common";
import { ArtPreview } from "./ArtPreview";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { X } from "lucide-react";

interface Props {
  variation: Variation;
  prompt: string;
  onMoreLikeThis: () => void;
  onClose: () => void;
  wallet: string | null;
}

export function DetailPanel({
  variation,
  prompt,
  onMoreLikeThis,
  onClose,
  wallet,
}: Props) {
  const router = useRouter();
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);

  const handleMint = async () => {
    if (!wallet) {
      setMintError("Connect your wallet first");
      return;
    }
    setMinting(true);
    setMintError(null);
    try {
      const res = await fetch("/api/mint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...variation, prompt }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Mint preparation failed");
      }
      const data = await res.json();
      router.push(`/asset/${data.placeholderMintAddress}`);
    } catch (err) {
      setMintError(err instanceof Error ? err.message : "Mint failed");
    } finally {
      setMinting(false);
    }
  };

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: "spring", damping: 30, stiffness: 200 }}
      className="w-[400px] shrink-0 bg-[var(--bg)] flex flex-col z-20 border-l border-[var(--border)]"
    >
      {/* Header */}
      <div className="p-6 border-b border-[var(--border)] flex justify-between items-center">
        <h3 className="font-serif text-2xl text-white italic">Inspection.</h3>
        <button
          onClick={onClose}
          className="text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
        >
          <X size={20} strokeWidth={1} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Preview */}
        <div className="border border-[var(--border)] p-2">
          <ArtPreview variation={variation} size={340} />
        </div>

        {variation.description && (
          <p className="font-mono text-xs text-[var(--text-dim)] leading-relaxed">
            {variation.description}
          </p>
        )}

        {/* Specs */}
        <div>
          <h4 className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest mb-4 border-b border-[var(--border)] pb-2">
            Technical Specifications
          </h4>
          <div className="font-mono text-[11px] text-[var(--text)] leading-loose">
            <div className="flex justify-between border-b border-[var(--border)]/50 py-1">
              <span className="text-[var(--text-dim)]">Template:</span>
              <span>{variation.templateId}</span>
            </div>
            <div className="flex justify-between border-b border-[var(--border)]/50 py-1">
              <span className="text-[var(--text-dim)]">Seed:</span>
              <span>{variation.seed}</span>
            </div>
            <div className="flex justify-between border-b border-[var(--border)]/50 py-1">
              <span className="text-[var(--text-dim)]">Dimensions:</span>
              <span>1080x1080px</span>
            </div>
          </div>
        </div>

        {/* Palette */}
        <div>
          <h4 className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest mb-4 border-b border-[var(--border)] pb-2">
            Extracted Palette
          </h4>
          <div className="flex gap-1 h-8 border border-[var(--border)] p-1">
            {variation.palette.map((c, i) => (
              <div
                key={i}
                className="flex-1 h-full"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>

        {/* Tags */}
        {variation.tags && variation.tags.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {variation.tags.map((tag, i) => (
              <span
                key={i}
                className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest border border-[var(--border)] px-2 py-1"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Params JSON */}
        <div>
          <h4 className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest mb-4 border-b border-[var(--border)] pb-2">
            Parameters
          </h4>
          <pre className="font-mono text-[10px] text-[var(--text-dim)] leading-relaxed overflow-auto max-h-[200px] bg-[var(--bg-card)] border border-[var(--border)] p-3">
            {JSON.stringify(variation.params, null, 2)}
          </pre>
        </div>
      </div>

      {/* Actions */}
      <div className="p-6 border-t border-[var(--border)] bg-[var(--bg)] flex flex-col gap-3">
        <Button variant="outline" className="w-full" onClick={onMoreLikeThis}>
          Iterate Further
        </Button>
        <Button
          className="w-full"
          onClick={handleMint}
          disabled={minting || !wallet}
        >
          {minting
            ? "Preparing..."
            : !wallet
            ? "Auth Required to Mint"
            : "Inscribe to Chain"}
        </Button>
        {mintError && (
          <div className="font-mono text-[10px] text-[var(--danger)] uppercase tracking-widest">
            {mintError}
          </div>
        )}
      </div>
    </motion.div>
  );
}
