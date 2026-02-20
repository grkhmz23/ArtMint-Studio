"use client";

import type { RenderableTemplateId } from "@artmint/common";
import { cn } from "@/lib/utils";

interface Props {
  value: RenderableTemplateId;
  onChange: (id: RenderableTemplateId) => void;
}

const templates: { id: RenderableTemplateId; label: string }[] = [
  { id: "flow_fields", label: "Flow // Structure" },
  { id: "jazz_noir", label: "Noise // Topology" },
];

export function TemplateSelector({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {templates.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "py-3 px-4 text-left border font-mono text-xs uppercase tracking-widest transition-colors",
            value === t.id
              ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5"
              : "border-[var(--border)] text-[var(--text-dim)] hover:text-white"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
