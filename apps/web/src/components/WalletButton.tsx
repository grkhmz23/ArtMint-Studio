"use client";

import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface WalletButtonProps {
  className?: string;
}

export function WalletButton({ className }: WalletButtonProps) {
  const { publicKey, connected, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [hovered, setHovered] = useState(false);

  // Fetch balance when connected
  useEffect(() => {
    if (publicKey && connected) {
      connection.getBalance(publicKey).then((lamports) => {
        setBalance(lamports / 1e9);
      });
    }
  }, [publicKey, connected, connection]);

  // Format wallet address
  const formatAddress = (key: typeof publicKey) => {
    if (!key) return "";
    const base58 = key.toBase58();
    return `${base58.slice(0, 4)}...${base58.slice(-4)}`;
  };

  // Not connected - show connect button
  if (!connected || !publicKey) {
    return (
      <button
        onClick={() => setVisible(true)}
        disabled={connecting}
        className={cn(
          "relative overflow-hidden",
          "px-4 py-2",
          "border border-[var(--accent)]",
          "bg-[var(--accent)] text-[var(--accent-text)]",
          "font-mono text-[10px] uppercase tracking-[0.15em] font-bold",
          "transition-all duration-200",
          "hover:bg-transparent hover:text-[var(--accent)]",
          "active:scale-[0.98]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
      >
        {connecting ? (
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 border border-[var(--accent-text)] border-t-transparent rounded-full animate-spin" />
            Connecting
          </span>
        ) : (
          "Connect Wallet"
        )}
      </button>
    );
  }

  // Connected - show wallet info with disconnect option
  return (
    <div
      className={cn(
        "relative flex items-center gap-3",
        "border border-[var(--border)]",
        "bg-[var(--bg-card)]",
        "px-3 py-2",
        className
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Connection indicator */}
      <span className="w-2 h-2 bg-[var(--success)] animate-pulse" />

      {/* Wallet info */}
      <div className="flex flex-col">
        <span className="font-mono text-[10px] text-[var(--text)] tracking-wider">
          {formatAddress(publicKey)}
        </span>
        {balance !== null && (
          <span className="font-mono text-[9px] text-[var(--text-dim)]">
            {balance.toFixed(4)} SOL
          </span>
        )}
      </div>

      {/* Disconnect button - appears on hover */}
      <button
        onClick={disconnect}
        className={cn(
          "ml-2 px-2 py-1",
          "border border-[var(--danger)]",
          "text-[var(--danger)]",
          "font-mono text-[9px] uppercase tracking-wider",
          "transition-all duration-200",
          "hover:bg-[var(--danger)] hover:text-white",
          hovered ? "opacity-100" : "opacity-0 w-0 px-0 border-0 overflow-hidden"
        )}
      >
        Disconnect
      </button>
    </div>
  );
}
