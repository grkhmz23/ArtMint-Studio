"use client";

import { Button } from "@/components/ui/button";

interface Props {
  seed: number;
  onChange: (seed: number) => void;
}

export function SeedInput({ seed, onChange }: Props) {
  const randomize = () => {
    onChange(Math.floor(Math.random() * 999999999));
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted">Seed</label>
      <div className="flex gap-2">
        <input
          type="number"
          min={0}
          max={999999999}
          value={seed}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 0 && v <= 999999999) onChange(v);
          }}
          className="flex-1 h-8 px-2 rounded-md border border-border bg-background text-foreground text-sm font-mono"
        />
        <Button variant="outline" size="sm" onClick={randomize} className="h-8 px-3 text-xs">
          Dice
        </Button>
      </div>
    </div>
  );
}
