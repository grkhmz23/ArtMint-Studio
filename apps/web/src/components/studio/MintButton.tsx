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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mint failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleMint}
        disabled={disabled || loading}
        className="w-full"
        size="lg"
      >
        {loading ? "Minting..." : "Mint NFT"}
      </Button>
      {error && (
        <p className="text-xs text-danger">{error}</p>
      )}
      {success && (
        <p className="text-xs text-success">Mint prepared successfully!</p>
      )}
    </div>
  );
}
