"use client";

import { useCallback } from "react";
import type { DragEvent, ChangeEvent } from "react";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  file: File | null;
  onFile: (file: File | null) => void;
  disabled?: boolean;
}

export function UploadDropzone({ file, onFile, disabled }: UploadDropzoneProps) {
  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      onFile(files[0]);
    },
    [onFile]
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (disabled) return;
      handleFiles(event.dataTransfer.files);
    },
    [disabled, handleFiles]
  );

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(event) => event.preventDefault()}
      className={cn(
        "border border-dashed border-[var(--border)] rounded-lg p-6 text-center bg-[var(--bg)]/40",
        disabled && "opacity-60"
      )}
    >
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
        id="upload-input"
      />
      <label htmlFor="upload-input" className="cursor-pointer">
        <div className="font-mono text-xs uppercase tracking-widest text-[var(--text-dim)]">
          Drag & drop or click to upload
        </div>
        <div className="mt-2 font-serif text-2xl text-white">
          {file ? file.name : "Select an image file"}
        </div>
        <div className="mt-3 text-[11px] text-[var(--text-dim)] font-mono uppercase tracking-widest">
          PNG, JPG, WEBP (GIF optional) · max 25MB · no SVG
        </div>
      </label>
    </div>
  );
}
