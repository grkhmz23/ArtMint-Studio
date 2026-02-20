"use client";

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
    <div className="flex gap-1 h-8 border border-[var(--border)] p-1 items-center">
      {palette.map((color, i) => (
        <div key={`${i}-${color}`} className="relative group h-full flex-1">
          <input
            type="color"
            value={color}
            onChange={(e) => updateColor(i, e.target.value)}
            className="w-full h-full cursor-pointer border-none p-0 bg-transparent"
            style={{ appearance: "none", WebkitAppearance: "none" }}
          />
          {palette.length > 2 && (
            <button
              onClick={() => removeColor(i)}
              className="absolute -top-1 -right-1 w-3 h-3 text-[8px] leading-none bg-[var(--danger)] text-white hidden group-hover:flex items-center justify-center"
            >
              x
            </button>
          )}
        </div>
      ))}
      {palette.length < 8 && (
        <button
          onClick={addColor}
          className="h-full px-2 font-mono text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)] border-l border-[var(--border)] transition-colors"
        >
          +
        </button>
      )}
    </div>
  );
}
