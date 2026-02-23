"use client";

import type { Variation } from "@artmint/common";
import { ArtPreview } from "./ArtPreview";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { Check } from "lucide-react";

interface Props {
  variations: Variation[];
  selectedIndex: number | null;
  onSelect?: (index: number) => void;
  batchMode?: boolean;
  selectedBatch?: Set<number>;
  onToggleBatch?: (index: number) => void;
}

export function VariationGrid({ 
  variations, 
  selectedIndex, 
  onSelect,
  batchMode = false,
  selectedBatch = new Set(),
  onToggleBatch,
}: Props) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-px bg-[var(--border)] border border-[var(--border)]"
    >
      {variations.map((v, i) => {
        const isSelected = selectedIndex === i;
        const isBatchSelected = selectedBatch.has(i);
        
        return (
          <motion.div 
            key={`${v.templateId}-${v.seed}`} 
            variants={fadeUp} 
            className="bg-[var(--bg)] group relative"
          >
            <div
              className={cn(
                "p-4 transition-colors relative h-full flex flex-col",
                batchMode && "cursor-pointer",
                !batchMode && onSelect && "cursor-pointer",
                isSelected && !batchMode
                  ? "bg-[var(--bg-hover)]"
                  : isBatchSelected
                  ? "bg-[var(--accent)]/10"
                  : "hover:bg-[var(--bg-card)]"
              )}
              onClick={() => {
                if (batchMode && onToggleBatch) {
                  onToggleBatch(i);
                } else if (onSelect) {
                  onSelect(i);
                }
              }}
            >
              {/* Batch Selection Checkbox */}
              {batchMode && (
                <div
                  className={cn(
                    "absolute top-3 right-3 z-10 w-6 h-6 border-2 flex items-center justify-center transition-colors",
                    isBatchSelected
                      ? "bg-[var(--accent)] border-[var(--accent)] text-black"
                      : "bg-[var(--bg)] border-[var(--border)] group-hover:border-[var(--accent)]"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleBatch?.(i);
                  }}
                >
                  {isBatchSelected && <Check size={14} strokeWidth={3} />}
                </div>
              )}

              <div className="flex justify-between items-center mb-3 font-mono text-[10px] text-[var(--text-dim)] uppercase">
                <span>{v.title ?? v.templateId}</span>
                <span className="text-[var(--accent)]">#{v.seed}</span>
              </div>
              <div className={cn(
                "aspect-square bg-black border overflow-hidden",
                isBatchSelected ? "border-[var(--accent)]" : "border-[var(--border)]"
              )}>
                <ArtPreview variation={v} size={300} />
              </div>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
