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
    <div className="space-y-6">
      {Object.entries(meta).map(([key, m]: [string, ParameterMetaEntry]) => (
        <div key={key} className="space-y-3">
          <div className="flex justify-between items-center font-mono text-xs uppercase tracking-widest text-[var(--text-dim)]">
            <span>{m.label}</span>
            <span className="text-white">
              {params[key] != null
                ? Number.isInteger(m.step)
                  ? params[key]
                  : params[key].toFixed(2)
                : m.min}
            </span>
          </div>
          <input
            type="range"
            min={m.min}
            max={m.max}
            step={m.step}
            value={params[key] ?? m.min}
            onChange={(e) => updateParam(key, parseFloat(e.target.value))}
          />
        </div>
      ))}
    </div>
  );
}
