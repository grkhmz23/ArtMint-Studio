"use client";

import { cn } from "@/lib/utils";

interface OptimizationSettingsProps {
  mintMaxSide: number;
  fit: "contain" | "cover";
  format: "webp" | "png";
  quality: number;
  onChange: (next: {
    mintMaxSide?: number;
    fit?: "contain" | "cover";
    format?: "webp" | "png";
    quality?: number;
  }) => void;
}

export function OptimizationSettings({
  mintMaxSide,
  fit,
  format,
  quality,
  onChange,
}: OptimizationSettingsProps) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-2">
          Mint Size (max side)
        </label>
        <div className="flex gap-2">
          {[2048, 4096].map((size) => (
            <button
              key={size}
              onClick={() => onChange({ mintMaxSide: size })}
              className={cn(
                "flex-1 border px-4 py-2 text-[11px] font-mono uppercase tracking-widest",
                mintMaxSide === size
                  ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5"
                  : "border-[var(--border)] text-[var(--text-dim)]"
              )}
            >
              {size}px
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-2">
          Fit Mode
        </label>
        <div className="flex gap-2">
          {([
            { value: "contain", label: "Contain" },
            { value: "cover", label: "Cover" },
          ] as const).map((option) => (
            <button
              key={option.value}
              onClick={() => onChange({ fit: option.value })}
              className={cn(
                "flex-1 border px-4 py-2 text-[11px] font-mono uppercase tracking-widest",
                fit === option.value
                  ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5"
                  : "border-[var(--border)] text-[var(--text-dim)]"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-2">
          Output Format
        </label>
        <div className="flex gap-2">
          {([
            { value: "webp", label: "WebP" },
            { value: "png", label: "PNG" },
          ] as const).map((option) => (
            <button
              key={option.value}
              onClick={() => onChange({ format: option.value })}
              className={cn(
                "flex-1 border px-4 py-2 text-[11px] font-mono uppercase tracking-widest",
                format === option.value
                  ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5"
                  : "border-[var(--border)] text-[var(--text-dim)]"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-2">
          Quality ({quality.toFixed(2)})
        </label>
        <input
          type="range"
          min={0.7}
          max={0.95}
          step={0.01}
          value={quality}
          onChange={(event) => onChange({ quality: parseFloat(event.target.value) })}
          className={cn("w-full", format === "png" && "opacity-40")}
          disabled={format === "png"}
        />
        <div className="text-[10px] text-[var(--text-dim)] font-mono uppercase tracking-widest mt-1">
          {format === "png" ? "Lossless PNG" : "Applies to WebP"}
        </div>
      </div>
    </div>
  );
}
