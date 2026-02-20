"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { CodeEditor } from "@/components/studio/CodeEditor";
import {
  CodePreview,
  type CodePreviewHandle,
  type CodeMode,
} from "@/components/studio/CodePreview";
import { SeedInput } from "@/components/studio/SeedInput";
import { PaletteEditor } from "@/components/studio/PaletteEditor";
import { useAuth } from "@/lib/use-auth";
import { useWallet } from "@solana/wallet-adapter-react";
import { presets } from "@artmint/common";
import { starterSvgCode, starterJsCode } from "@/components/studio/starterCode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Play, TerminalSquare, X } from "lucide-react";

export default function CodeStudioPage() {
  const { publicKey } = useWallet();
  const { authenticated, signingIn, signIn, error: authError } = useAuth();

  const [mode, setMode] = useState<CodeMode>("svg");
  const [code, setCode] = useState(starterSvgCode);
  const [liveCode, setLiveCode] = useState(starterSvgCode);
  const [seed, setSeed] = useState(() =>
    Math.floor(Math.random() * 999999999)
  );
  const [palette, setPalette] = useState<string[]>(presets[0]!.defaultPalette);
  const [title, setTitle] = useState("");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [mintLoading, setMintLoading] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintSuccess, setMintSuccess] = useState(false);

  const previewRef = useRef<CodePreviewHandle>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      <div className="noise-overlay" />

      {/* Editorial IDE Toolbar */}
      <div className="h-14 border-b border-[var(--border)] bg-[var(--bg)] flex items-center px-6 justify-between shrink-0 z-10">
        <div className="flex items-center gap-8">
          <div className="font-serif text-xl italic text-white pr-6 border-r border-[var(--border)]">
            Terminal.
          </div>
          <div className="flex font-mono text-[10px] uppercase tracking-widest border border-[var(--border)] p-1 bg-[var(--bg-card)]">
            <button
              className={cn(
                "px-4 py-1 transition-colors",
                mode === "svg"
                  ? "bg-[var(--text)] text-black"
                  : "text-[var(--text-dim)] hover:text-white"
              )}
              onClick={() => handleModeSwitch("svg")}
            >
              SVG Markup
            </button>
            <button
              className={cn(
                "px-4 py-1 transition-colors",
                mode === "javascript"
                  ? "bg-[var(--text)] text-black"
                  : "text-[var(--text-dim)] hover:text-white"
              )}
              onClick={() => handleModeSwitch("javascript")}
            >
              Canvas API
            </button>
          </div>

          {/* Seed + Palette for JS mode */}
          {mode === "javascript" && (
            <div className="flex items-center gap-4">
              <div className="w-32">
                <SeedInput seed={seed} onChange={setSeed} />
              </div>
              <div className="w-48">
                <PaletteEditor palette={palette} onChange={setPalette} />
              </div>
            </div>
          )}

          <div className="w-32">
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8 text-[10px] tracking-widest"
              maxLength={200}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2"
            onClick={handleRun}
          >
            <Play size={10} fill="currentColor" /> Execute
          </Button>

          <div className="w-px h-6 bg-[var(--border)]" />

          {needsWallet && (
            <span className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest">
              Connect wallet
            </span>
          )}
          {needsAuth && (
            <Button size="sm" variant="outline" className="h-8" onClick={signIn} disabled={signingIn}>
              {signingIn ? "Signing..." : "Authenticate"}
            </Button>
          )}
          {authError && (
            <span className="font-mono text-[10px] text-[var(--danger)]">
              {authError}
            </span>
          )}

          <Button
            size="sm"
            className="h-8"
            onClick={handleMint}
            disabled={!authenticated || mintLoading || !!renderError}
          >
            {mintLoading ? "Inscribing..." : "Inscribe Artifact"}
          </Button>

          {mintSuccess && (
            <span className="font-mono text-[10px] text-[var(--success)] uppercase tracking-widest">
              Inscribed.
            </span>
          )}
        </div>
      </div>

      {/* Error banner */}
      {(renderError || mintError) && (
        <div className="px-6 py-3 bg-[var(--danger)]/10 border-b border-[var(--danger)]/30 flex items-center gap-3 z-10">
          <span className="font-mono text-xs text-[var(--danger)] uppercase tracking-widest flex-1">
            {renderError || mintError}
          </span>
          <button
            onClick={() => {
              setRenderError(null);
              setMintError(null);
            }}
            className="text-[var(--danger)] hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Side */}
        <div className="w-1/2 border-r border-[var(--border)] bg-[#050505] flex flex-col">
          <div className="flex justify-between items-center px-6 py-3 border-b border-[#222]">
            <span className="font-mono text-[10px] text-[var(--accent)] uppercase tracking-widest flex items-center gap-2">
              <TerminalSquare size={12} />{" "}
              {mode === "javascript" ? "main.js" : "vector.svg"}
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <CodeEditor
              code={code}
              onChange={setCode}
              language={mode === "svg" ? "xml" : "javascript"}
            />
          </div>
        </div>

        {/* Preview Side */}
        <div
          className="w-1/2 bg-[var(--bg)] relative flex items-center justify-center"
          style={{
            backgroundImage:
              "url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')",
          }}
        >
          <div className="absolute top-6 right-6 font-mono text-[10px] text-[var(--accent)] uppercase tracking-widest flex items-center gap-2 z-10">
            <div className="w-1.5 h-1.5 bg-[var(--accent)] animate-pulse" />{" "}
            Output Buffer
          </div>

          <div className="w-full h-full">
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
    </div>
  );
}
