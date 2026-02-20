"use client";

import type { ParameterMetaEntry } from "@artmint/common";
import { parameterMeta } from "@artmint/common";

interface Props {
  templateId: string;
  params: Record<string, number>;
  onChange: (params: Record<string, number>) => void;
}

export function ParameterSliders({ templateId, params, onChange }: Props) {
  const meta = parameterMeta[templateId];
  if (!meta) return null;

  const updateParam = (key: string, value: number) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <div className="space-y-3">
      <label className="text-xs font-medium text-muted">Parameters</label>
      {Object.entries(meta).map(([key, m]: [string, ParameterMetaEntry]) => (
        <div key={key} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted">{m.label}</span>
            <span className="font-mono text-foreground">
              {Number.isInteger(m.step) ? params[key] : params[key]?.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={m.min}
            max={m.max}
            step={m.step}
            value={params[key] ?? m.min}
            onChange={(e) => updateParam(key, parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none bg-border accent-accent cursor-pointer"
          />
        </div>
      ))}
    </div>
  );
}
