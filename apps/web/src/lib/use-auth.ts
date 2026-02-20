"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

export function useAuth() {
  const { publicKey, signMessage } = useWallet();

  const [authenticated, setAuthenticated] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      if (data.authenticated && data.wallet === publicKey?.toBase58()) {
        setAuthenticated(true);
      } else {
        setAuthenticated(false);
      }
    } catch {
      setAuthenticated(false);
    }
  }, [publicKey]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const signIn = useCallback(async () => {
    if (!publicKey || !signMessage) return;
    setSigningIn(true);
    setError(null);

    try {
      // 1. Get nonce
      const nonceRes = await fetch("/api/auth/nonce");
      if (!nonceRes.ok) {
        const err = await nonceRes.json().catch(() => ({}));
        throw new Error(err.error ?? `Nonce request failed (${nonceRes.status})`);
      }
      const { nonce, message } = await nonceRes.json();

      // 2. Sign message with wallet
      const encoder = new TextEncoder();
      const messageBytes = encoder.encode(message);
      const signatureBytes = await signMessage(messageBytes);

      // 3. Convert signature to base58
      const bs58Module = await import("bs58");
      const signatureB58 = bs58Module.default.encode(signatureBytes);

      // 4. Verify with server
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          nonce,
          signature: signatureB58,
        }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.error ?? "Sign-in failed");
      }

      setAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setSigningIn(false);
    }
  }, [publicKey, signMessage]);

  return { authenticated, signingIn, signIn, error, checkSession };
}
