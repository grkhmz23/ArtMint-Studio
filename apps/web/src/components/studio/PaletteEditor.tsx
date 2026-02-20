"use client";

import { Button } from "@/components/ui/button";

interface Props {
  palette: string[];
  onChange: (palette: string[]) => void;
}

export function PaletteEditor({ palette, onChange }: Props) {
  const updateColor = (index: number, color: string) => {
    const next = [...palette];
    next[index] = color;
    onChange(next);
  };

  const removeColor = (index: number) => {
    if (palette.length <= 2) return;
    onChange(palette.filter((_, i) => i !== index));
  };

  const addColor = () => {
    if (palette.length >= 8) return;
    onChange([...palette, "#ffffff"]);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted">Palette</label>
      <div className="flex flex-wrap items-center gap-2">
        {palette.map((color, i) => (
          <div key={i} className="relative group">
            <input
              type="color"
              value={color}
              onChange={(e) => updateColor(i, e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent p-0"
              style={{ appearance: "none", WebkitAppearance: "none" }}
            />
            {palette.length > 2 && (
              <button
                onClick={() => removeColor(i)}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-danger text-white text-[10px] leading-none hidden group-hover:flex items-center justify-center"
              >
                x
              </button>
            )}
          </div>
        ))}
        {palette.length < 8 && (
          <Button variant="outline" size="sm" onClick={addColor} className="h-8 px-2 text-xs">
            +
          </Button>
        )}
      </div>
    </div>
  );
}
