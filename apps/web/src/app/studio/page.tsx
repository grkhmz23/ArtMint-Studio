"use client";

import { useState, useCallback, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Header } from "@/components/Header";
import { VariationGrid } from "@/components/VariationGrid";
import { DetailPanel } from "@/components/DetailPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Variation } from "@artmint/common";
import { presets } from "@artmint/common";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { X } from "lucide-react";

export default function StudioPage() {
  const { publicKey, signMessage } = useWallet();

  const [prompt, setPrompt] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("minimal");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [variations, setVariations] = useState<Variation[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [authenticated, setAuthenticated] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
  const [quotaLimit, setQuotaLimit] = useState<number>(0);

  useEffect(() => {
    checkSession();
  }, [publicKey]);

  async function checkSession() {
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      if (data.authenticated && data.wallet === publicKey?.toBase58()) {
        setAuthenticated(true);
        fetchQuota();
      } else {
        setAuthenticated(false);
        setQuotaRemaining(null);
      }
    } catch {
      setAuthenticated(false);
    }
  }

  async function fetchQuota() {
    try {
      const res = await fetch("/api/quota");
      const data = await res.json();
      if (data.authenticated) {
        setQuotaRemaining(data.remaining);
        setQuotaLimit(data.limit);
      }
    } catch {
      // Ignore
    }
  }

  async function handleSignIn() {
    if (!publicKey || !signMessage) return;
    setSigningIn(true);
    setError(null);
    try {
      const nonceRes = await fetch("/api/auth/nonce");
      if (!nonceRes.ok) {
        const err = await nonceRes.json().catch(() => ({}));
        throw new Error(err.error ?? `Nonce request failed (${nonceRes.status})`);
      }
      const { nonce, message } = await nonceRes.json();
      const encoder = new TextEncoder();
      const messageBytes = encoder.encode(message);
      const signatureBytes = await signMessage(messageBytes);
      const bs58Module = await import("bs58");
      const signatureB58 = bs58Module.default.encode(signatureBytes);
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
      fetchQuota();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setSigningIn(false);
    }
  }

  const generateVariations = useCallback(
    async (baseParams?: Record<string, unknown>) => {
      if (!prompt.trim()) return;
      setLoading(true);
      setError(null);
      setSelectedIndex(null);
      try {
        const res = await fetch("/api/ai/variations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            prompt: prompt.trim(),
            preset: selectedPreset,
            templateId: selectedTemplate || undefined,
            baseParams,
            count: 12,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Failed to generate variations");
        }
        const data = await res.json();
        setVariations(data.variations);
        if (data.quota) {
          setQuotaRemaining(data.quota.remaining);
          setQuotaLimit(data.quota.limit);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate");
      } finally {
        setLoading(false);
      }
    },
    [prompt, selectedPreset, selectedTemplate]
  );

  const handleMoreLikeThis = useCallback(
    (variation: Variation) => {
      generateVariations({
        templateId: variation.templateId,
        seed: variation.seed,
        palette: variation.palette,
        params: variation.params,
      });
    },
    [generateVariations]
  );

  const selected =
    selectedIndex !== null ? variations[selectedIndex] ?? null : null;
  const needsWallet = !publicKey;
  const needsAuth = publicKey && !authenticated;

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="noise-overlay" />

      {/* Editorial Control Bar */}
      <div className="p-6 border-b border-[var(--border)] bg-[var(--bg)] z-10 shrink-0">
        <div className="max-w-[1600px] mx-auto">
          <div className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest mb-4 flex justify-between">
            <span>Module: AI Synthesis</span>
            {authenticated && quotaRemaining !== null && (
              <span
                className={
                  quotaRemaining <= 2 ? "text-[var(--danger)]" : undefined
                }
              >
                Compute Quota: {quotaRemaining}/{quotaLimit}
              </span>
            )}
          </div>

          {/* Auth banners */}
          {needsWallet && (
            <div className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-widest border border-[var(--border)] p-4 mb-4">
              Connect your wallet to initialize the generation matrix.
            </div>
          )}
          {needsAuth && (
            <div className="flex items-center gap-4 border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4 mb-4">
              <span className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-widest">
                Authentication required:
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSignIn}
                disabled={signingIn}
              >
                {signingIn ? "Authenticating..." : "Sign In With Solana"}
              </Button>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-6 items-end">
            <div className="flex-1 w-full space-y-2">
              <label className="font-serif text-2xl text-white italic">
                The Prompt
              </label>
              <Input
                placeholder="Enter parameters for synthesis... (e.g. 'Geometric brutalism in acid green')"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="h-14 text-base bg-[var(--bg-card)] border-[var(--border)] text-[var(--accent)] placeholder:text-[var(--text-dim)]"
                onKeyDown={(e) =>
                  e.key === "Enter" && authenticated && generateVariations()
                }
              />
            </div>

            <div className="w-full lg:w-auto flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <label className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest block">
                  Aesthetic Model
                </label>
                <div className="flex border border-[var(--border)] p-1">
                  {presets.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPreset(p.id)}
                      className={cn(
                        "px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors",
                        selectedPreset === p.id
                          ? "bg-[var(--text)] text-black"
                          : "text-[var(--text-dim)] hover:text-white"
                      )}
                      title={p.description}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                size="lg"
                onClick={() => generateVariations()}
                disabled={loading || !prompt.trim() || !authenticated}
                className="h-[46px] min-w-[180px]"
              >
                {loading ? "Synthesizing..." : "Execute"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-6 py-3 bg-[var(--danger)]/10 border-b border-[var(--danger)]/30 flex items-center gap-3">
          <span className="font-mono text-xs text-[var(--danger)] uppercase tracking-widest flex-1">
            {error}
          </span>
          <button
            onClick={() => setError(null)}
            className="text-[var(--danger)] hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden relative bg-[var(--bg)]">
        {/* Gallery Grid */}
        <div className="flex-1 overflow-y-auto p-8 border-r border-[var(--border)]">
          <div className="max-w-[1600px] mx-auto">
            {variations.length === 0 ? (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center opacity-50">
                <div className="font-serif text-6xl italic text-[var(--border)] mb-4">
                  Awaiting Input
                </div>
                <p className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-widest max-w-[400px] leading-relaxed">
                  Provide conceptual parameters above to initialize the latent
                  space generation matrix.
                </p>
              </div>
            ) : (
              <VariationGrid
                variations={variations}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
              />
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <AnimatePresence>
          {selected && (
            <DetailPanel
              variation={selected}
              prompt={prompt}
              onMoreLikeThis={() => handleMoreLikeThis(selected)}
              onClose={() => setSelectedIndex(null)}
              wallet={publicKey?.toBase58() ?? null}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
