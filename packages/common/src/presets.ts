export type Palette = string[];

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  defaultPalette: Palette;
  suggestedTemplate: "flow_fields" | "jazz_noir";
}

export const presets: StylePreset[] = [
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean lines, muted tones, geometric simplicity",
    defaultPalette: ["#1a1a2e", "#16213e", "#0f3460", "#e94560", "#f5f5f5"],
    suggestedTemplate: "flow_fields",
  },
  {
    id: "glitch",
    name: "Glitch",
    description: "Digital artifacts, neon fragments, corrupted data aesthetics",
    defaultPalette: ["#0d0d0d", "#ff0055", "#00ffaa", "#aa00ff", "#ffff00"],
    suggestedTemplate: "flow_fields",
  },
  {
    id: "jazz_noir",
    name: "Jazz Noir",
    description: "Dark cityscapes, neon reflections, smoky atmosphere",
    defaultPalette: ["#0a0a0f", "#1a0a2e", "#ff6b35", "#00d4ff", "#ff0066"],
    suggestedTemplate: "jazz_noir",
  },
  {
    id: "bonk_mode",
    name: "BONK Mode",
    description: "Chaotic energy, meme-inspired, maximum vibrancy",
    defaultPalette: ["#ff6600", "#ffcc00", "#ff0066", "#00ff99", "#0066ff"],
    suggestedTemplate: "flow_fields",
  },
];
