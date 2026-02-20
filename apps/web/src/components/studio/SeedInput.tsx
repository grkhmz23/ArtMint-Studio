"use client";

import { Dices } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Props {
  seed: number;
  onChange: (seed: number) => void;
}

export function SeedInput({ seed, onChange }: Props) {
  const randomize = () => {
    onChange(Math.floor(Math.random() * 999999999));
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={0}
        max={999999999}
        value={seed}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v) && v >= 0 && v <= 999999999) onChange(v);
        }}
        className="h-8 text-xs tracking-widest flex-1"
      />
      <button
        onClick={randomize}
        className="text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors p-1"
        title="Randomize seed"
      >
        <Dices size={16} />
      </button>
    </div>
  );
}
