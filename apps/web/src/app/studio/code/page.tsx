"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { Play, Save, TerminalSquare, X, HelpCircle } from "lucide-react";

export default function CodeStudioPage() {
  const router = useRouter();
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
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

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
      const data = await res.json();
      if (!data.placeholderMintAddress) {
        throw new Error("Mint was prepared, but no placeholder asset was returned");
      }
      setMintSuccess(true);
      router.push(`/asset/${data.placeholderMintAddress}`);
    } catch (err) {
      setMintError(err instanceof Error ? err.message : "Mint failed");
    } finally {
      setMintLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!authenticated) return;
    setSaveLoading(true);
    setSaveSuccess(false);
    try {
      // Capture a small preview
      let imageUrl: string | undefined;
      try {
        const preview = previewRef.current;
        if (preview) {
          imageUrl = await preview.capture();
        }
      } catch {
        // Preview capture is optional
      }

      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "code",
          title: title || `${mode === "svg" ? "SVG" : "Canvas"} Draft`,
          data: { code, mode, seed, palette },
          imageUrl,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Save failed");
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setMintError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaveLoading(false);
    }
  };

  const needsWallet = !publicKey;
  const needsAuth = publicKey && !authenticated;

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="noise-overlay" />

      {/* Info Banner */}
      <div className="border-b border-[var(--border)] bg-[var(--bg-card)] px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[var(--accent)]" />
            <span className="font-mono text-[10px] text-[var(--accent)] uppercase tracking-widest">
              Live Coding
            </span>
          </div>
          <p className="font-mono text-[11px] text-[var(--text-dim)]">
            Write code to generate art. See live preview. Mint as NFT.
          </p>
          <div className="hidden sm:flex items-center gap-4 ml-auto">
            <span className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest">
              1. Code
            </span>
            <span className="text-[var(--border)]">→</span>
            <span className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest">
              2. Preview
            </span>
            <span className="text-[var(--border)]">→</span>
            <span className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest">
              3. Mint
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b border-[var(--border)] bg-[var(--bg)] flex items-center px-4 lg:px-6 justify-between shrink-0 z-10 py-2 gap-4 flex-wrap">
        <div className="flex items-center gap-4 lg:gap-6 flex-wrap">
          <div className="font-serif text-xl italic text-white pr-4 border-r border-[var(--border)] hidden sm:block">
            Draw with Code
          </div>

          {/* Mode Toggle */}
          <div className="flex font-mono text-[10px] uppercase tracking-widest border border-[var(--border)] p-0.5 bg-[var(--bg-card)]">
            <button
              className={cn(
                "px-3 py-1.5 transition-colors",
                mode === "svg"
                  ? "bg-[var(--accent)] text-black"
                  : "text-[var(--text-dim)] hover:text-white"
              )}
              onClick={() => handleModeSwitch("svg")}
              title="Write raw SVG markup to create vector art"
            >
              SVG
            </button>
            <button
              className={cn(
                "px-3 py-1.5 transition-colors",
                mode === "javascript"
                  ? "bg-[var(--accent)] text-black"
                  : "text-[var(--text-dim)] hover:text-white"
              )}
              onClick={() => handleModeSwitch("javascript")}
              title="Write JavaScript using Canvas API to create art"
            >
              Canvas JS
            </button>
          </div>

          {/* Seed + Palette for JS mode */}
          {mode === "javascript" && (
            <div className="flex items-center gap-3">
              <div className="w-28">
                <SeedInput seed={seed} onChange={setSeed} />
              </div>
              <div className="w-40">
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

          {/* Help toggle */}
          <button
            onClick={() => setShowHelp(!showHelp)}
            className={cn(
              "p-1.5 transition-colors",
              showHelp ? "text-[var(--accent)]" : "text-[var(--text-dim)] hover:text-white"
            )}
            title="Show API reference"
          >
            <HelpCircle size={16} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2"
            onClick={handleRun}
          >
            <Play size={10} fill="currentColor" /> Run
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
            variant="outline"
            className="h-8 gap-2"
            onClick={handleSaveDraft}
            disabled={!authenticated || saveLoading}
          >
            <Save size={10} />
            {saveLoading ? "Saving..." : saveSuccess ? "Saved!" : "Save Draft"}
          </Button>

          <Button
            size="sm"
            className="h-8"
            onClick={handleMint}
            disabled={!authenticated || mintLoading || !!renderError}
          >
            {mintLoading ? "Preparing..." : "Prepare Mint"}
          </Button>

          {mintSuccess && (
            <span className="font-mono text-[10px] text-[var(--success)] uppercase tracking-widest">
              Prepared
            </span>
          )}
        </div>
      </div>

      {/* Error banner */}
      {(renderError || mintError) && (
        <div className="px-6 py-2 bg-[var(--danger)]/10 border-b border-[var(--danger)]/30 flex items-center gap-3 z-10">
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

      {/* Help Panel */}
      {showHelp && (
        <div className="border-b border-[var(--border)] bg-[var(--bg-card)] px-6 py-4 z-10 shrink-0">
          <div className="max-w-[1600px] mx-auto">
            <div className="font-mono text-[10px] text-[var(--accent)] uppercase tracking-widest mb-3">
              {mode === "svg" ? "SVG Mode Reference" : "Canvas API Reference"}
            </div>
            {mode === "svg" ? (
              <div className="font-mono text-xs text-[var(--text-dim)] space-y-1 leading-relaxed">
                <p>Write standard SVG markup. Your code should be a complete <code className="text-[var(--accent)]">&lt;svg&gt;</code> element with <code className="text-[var(--accent)]">xmlns</code>, <code className="text-[var(--accent)]">viewBox</code>, <code className="text-[var(--accent)]">width</code>, and <code className="text-[var(--accent)]">height</code> attributes.</p>
                <p>Use SVG elements like <code className="text-[var(--accent)]">&lt;rect&gt;</code>, <code className="text-[var(--accent)]">&lt;circle&gt;</code>, <code className="text-[var(--accent)]">&lt;path&gt;</code>, <code className="text-[var(--accent)]">&lt;line&gt;</code>, <code className="text-[var(--accent)]">&lt;text&gt;</code>, <code className="text-[var(--accent)]">&lt;g&gt;</code>, <code className="text-[var(--accent)]">&lt;filter&gt;</code>, and more.</p>
              </div>
            ) : (
              <div className="font-mono text-xs text-[var(--text-dim)] leading-relaxed">
                <p className="mb-2">Your code runs in a sandboxed environment with these globals:</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-1">
                  <div><code className="text-[var(--accent)]">canvas</code> — HTML Canvas element</div>
                  <div><code className="text-[var(--accent)]">ctx</code> — 2D rendering context</div>
                  <div><code className="text-[var(--accent)]">WIDTH</code> — canvas width (1080)</div>
                  <div><code className="text-[var(--accent)]">HEIGHT</code> — canvas height (1080)</div>
                  <div><code className="text-[var(--accent)]">seed</code> — deterministic seed number</div>
                  <div><code className="text-[var(--accent)]">palette</code> — array of hex colors</div>
                  <div><code className="text-[var(--accent)]">random()</code> — seeded PRNG (0-1)</div>
                  <div><code className="text-[var(--accent)]">noise2D(x,y)</code> — Perlin noise (-1 to 1)</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Side */}
        <div className="w-1/2 border-r border-[var(--border)] bg-[#050505] flex flex-col">
          <div className="flex justify-between items-center px-4 py-2 border-b border-[#222]">
            <span className="font-mono text-[10px] text-[var(--accent)] uppercase tracking-widest flex items-center gap-2">
              <TerminalSquare size={12} />{" "}
              {mode === "javascript" ? "main.js" : "vector.svg"}
            </span>
            <span className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest">
              auto-preview: 800ms
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
        <div className="w-1/2 bg-[var(--bg)] relative flex flex-col">
          {/* Preview header */}
          <div className="flex justify-between items-center px-4 py-2 border-b border-[var(--border)] shrink-0">
            <span className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest">
              Live Preview
            </span>
            <span className="font-mono text-[10px] text-[var(--accent)] uppercase tracking-widest flex items-center gap-2">
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                renderError ? "bg-[var(--danger)]" : "bg-[var(--accent)] animate-pulse"
              )} />
              {renderError ? "Error" : "Active"}
            </span>
          </div>

          <div className="flex-1 min-h-0">
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
