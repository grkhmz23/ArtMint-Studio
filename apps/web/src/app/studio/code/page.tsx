"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { CodeEditor } from "@/components/studio/CodeEditor";
import { CodePreview, type CodePreviewHandle, type CodeMode } from "@/components/studio/CodePreview";
import { SeedInput } from "@/components/studio/SeedInput";
import { PaletteEditor } from "@/components/studio/PaletteEditor";
import { useAuth } from "@/lib/use-auth";
import { useWallet } from "@solana/wallet-adapter-react";
import { presets } from "@artmint/common";
import { starterSvgCode, starterJsCode } from "@/components/studio/starterCode";
import { Button } from "@/components/ui/button";

export default function CodeStudioPage() {
  const { publicKey } = useWallet();
  const { authenticated, signingIn, signIn, error: authError } = useAuth();

  const [mode, setMode] = useState<CodeMode>("svg");
  const [code, setCode] = useState(starterSvgCode);
  const [liveCode, setLiveCode] = useState(starterSvgCode);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 999999999));
  const [palette, setPalette] = useState<string[]>(presets[0]!.defaultPalette);
  const [title, setTitle] = useState("");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [mintLoading, setMintLoading] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintSuccess, setMintSuccess] = useState(false);

  const previewRef = useRef<CodePreviewHandle>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced auto-preview: update liveCode 800ms after code stops changing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLiveCode(code);
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [code]);

  const handleRun = useCallback(() => {
    setLiveCode(code);
  }, [code]);

  const handleModeSwitch = (newMode: CodeMode) => {
    setMode(newMode);
    setRenderError(null);
    setMintError(null);
    setMintSuccess(false);
    const newCode = newMode === "svg" ? starterSvgCode : starterJsCode;
    setCode(newCode);
    setLiveCode(newCode);
  };

  const handleMint = async () => {
    if (renderError) return;

    const preview = previewRef.current;
    if (!preview) {
      setMintError("Preview not ready");
      return;
    }

    setMintLoading(true);
    setMintError(null);
    setMintSuccess(false);

    try {
      const dataUrl = await preview.capture();

      const res = await fetch("/api/mint/custom", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code,
          mode,
          seed,
          palette,
          title: title || undefined,
          pngBase64: dataUrl,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Mint failed");
      }

      setMintSuccess(true);
    } catch (err) {
      setMintError(err instanceof Error ? err.message : "Mint failed");
    } finally {
      setMintLoading(false);
    }
  };

  const needsWallet = !publicKey;
  const needsAuth = publicKey && !authenticated;

  return (
    <div className="flex flex-col h-screen">
      <Header />

      {/* Top toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card flex-shrink-0 flex-wrap">
        {/* Mode toggle */}
        <div className="flex rounded-md border border-border overflow-hidden">
          <button
            onClick={() => handleModeSwitch("svg")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === "svg"
                ? "bg-accent text-white"
                : "bg-card text-muted hover:text-foreground"
            }`}
          >
            SVG
          </button>
          <button
            onClick={() => handleModeSwitch("javascript")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-border ${
              mode === "javascript"
                ? "bg-accent text-white"
                : "bg-card text-muted hover:text-foreground"
            }`}
          >
            JavaScript
          </button>
        </div>

        {/* Seed (only for JS mode) */}
        {mode === "javascript" && (
          <SeedInput seed={seed} onChange={setSeed} />
        )}

        {/* Palette (only for JS mode) */}
        {mode === "javascript" && (
          <PaletteEditor palette={palette} onChange={setPalette} />
        )}

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="h-8 px-2 rounded-md border border-border bg-background text-foreground text-xs w-40"
          maxLength={200}
        />

        <Button variant="secondary" size="sm" onClick={handleRun}>
          Run
        </Button>

        {/* Auth / Mint */}
        {needsWallet && (
          <span className="text-xs text-muted">Connect wallet to mint</span>
        )}
        {needsAuth && (
          <button
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white"
            onClick={signIn}
            disabled={signingIn}
          >
            {signingIn ? "Signing..." : "Sign In"}
          </button>
        )}
        {authError && <span className="text-xs text-danger">{authError}</span>}

        <Button
          size="sm"
          onClick={handleMint}
          disabled={!authenticated || mintLoading || !!renderError}
        >
          {mintLoading ? "Minting..." : "Mint NFT"}
        </Button>

        {mintSuccess && (
          <span className="text-xs text-success font-medium">Mint prepared!</span>
        )}
      </div>

      {/* Error banner */}
      {(renderError || mintError) && (
        <div className="px-4 py-3 bg-danger/10 border-b border-danger/30 flex items-start gap-3">
          <span className="text-danger font-bold text-sm mt-0.5">Error</span>
          <p className="text-sm text-danger font-mono flex-1">
            {renderError || mintError}
          </p>
          <button
            onClick={() => { setRenderError(null); setMintError(null); }}
            className="text-danger/60 hover:text-danger text-sm px-1"
          >
            dismiss
          </button>
        </div>
      )}

      {/* Split view: editor left, preview right */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 min-w-0">
          <CodeEditor
            code={code}
            onChange={setCode}
            language={mode === "svg" ? "xml" : "javascript"}
          />
        </div>

        <div className="flex-1 min-w-0 border-l border-border">
          <CodePreview
            ref={previewRef}
            code={liveCode}
            mode={mode}
            seed={seed}
            palette={palette}
            onError={setRenderError}
          />
        </div>
      </div>
    </div>
  );
}
