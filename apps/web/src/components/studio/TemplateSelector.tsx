"use client";

import type { RenderableTemplateId } from "@artmint/common";

interface Props {
  value: RenderableTemplateId;
  onChange: (id: RenderableTemplateId) => void;
}

const templates: { id: RenderableTemplateId; label: string }[] = [
  { id: "flow_fields", label: "Flow Fields" },
  { id: "jazz_noir", label: "Jazz Noir" },
];

export function TemplateSelector({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted">Template</label>
      <div className="flex gap-2">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex-1 h-9 rounded-md border text-sm font-medium transition-colors ${
              value === t.id
                ? "bg-accent text-white border-accent"
                : "bg-card text-foreground border-border hover:bg-card-hover"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
