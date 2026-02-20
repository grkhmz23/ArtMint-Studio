"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  onMint: () => Promise<void>;
  disabled?: boolean;
}

export function MintButton({ onMint, disabled }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleMint = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await onMint();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mint failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button
        onClick={handleMint}
        disabled={disabled || loading}
        className="w-full"
      >
        {loading ? "Inscribing..." : "Initialize Mint"}
      </Button>
      {error && (
        <p className="font-mono text-[10px] text-[var(--danger)] uppercase tracking-widest">
          {error}
        </p>
      )}
      {success && (
        <p className="font-mono text-[10px] text-[var(--success)] uppercase tracking-widest">
          Inscription confirmed.
        </p>
      )}
    </div>
  );
}
