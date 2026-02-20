"use client";

import type { Variation } from "@artmint/common";
import { ArtPreview } from "./ArtPreview";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";

interface Props {
  variations: Variation[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

export function VariationGrid({ variations, selectedIndex, onSelect }: Props) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-px bg-[var(--border)] border border-[var(--border)]"
    >
      {variations.map((v, i) => (
        <motion.div key={`${v.templateId}-${v.seed}`} variants={fadeUp} className="bg-[var(--bg)] group">
          <div
            className={cn(
              "p-4 cursor-pointer transition-colors relative h-full flex flex-col",
              selectedIndex === i
                ? "bg-[var(--bg-hover)]"
                : "hover:bg-[var(--bg-card)]"
            )}
            onClick={() => onSelect(i)}
          >
            <div className="flex justify-between items-center mb-3 font-mono text-[10px] text-[var(--text-dim)] uppercase">
              <span>{v.title ?? v.templateId}</span>
              <span className="text-[var(--accent)]">#{v.seed}</span>
            </div>
            <div className="aspect-square bg-black border border-[var(--border)] overflow-hidden">
              <ArtPreview variation={v} size={300} />
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
