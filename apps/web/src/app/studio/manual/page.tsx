"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/Header";
import { TemplateSelector } from "@/components/studio/TemplateSelector";
import { SeedInput } from "@/components/studio/SeedInput";
import { PaletteEditor } from "@/components/studio/PaletteEditor";
import { ParameterSliders } from "@/components/studio/ParameterSliders";
import { MintButton } from "@/components/studio/MintButton";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/use-auth";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import {
  defaultFlowFieldsParams,
  defaultJazzNoirParams,
  presets,
  type RenderableTemplateId,
} from "@artmint/common";

export default function ManualStudioPage() {
  const { publicKey } = useWallet();
  const { authenticated, signingIn, signIn, error: authError } = useAuth();

  const [templateId, setTemplateId] = useState<RenderableTemplateId>("flow_fields");
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 999999999));
  const [palette, setPalette] = useState<string[]>(presets[0]!.defaultPalette);
  const [params, setParams] = useState<Record<string, number>>(
    defaultFlowFieldsParams as unknown as Record<string, number>
  );
  const [title, setTitle] = useState("");

  const handleTemplateChange = (id: RenderableTemplateId) => {
    setTemplateId(id);
    setParams(
      id === "flow_fields"
        ? (defaultFlowFieldsParams as unknown as Record<string, number>)
        : (defaultJazzNoirParams as unknown as Record<string, number>)
    );
  };

  const previewSrc = useMemo(() => {
    const data = encodeURIComponent(
      JSON.stringify({ templateId, seed, palette, params, format: "svg" })
    );
    return `/api/render?data=${data}`;
  }, [templateId, seed, palette, params]);

  const handleMint = async () => {
    const res = await fetch("/api/mint", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        templateId,
        seed,
        palette,
        params,
        prompt: "manual",
        title: title || undefined,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Mint failed");
    }
  };

  const needsWallet = !publicKey;
  const needsAuth = publicKey && !authenticated;

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="noise-overlay" />

      <div className="flex flex-1 overflow-hidden">
        {/* Parameter Terminal (Left Sidebar) */}
        <div className="w-[320px] shrink-0 border-r border-[var(--border)] bg-[var(--bg)] flex flex-col overflow-y-auto">
          <div className="p-6 border-b border-[var(--border)]">
            <h2 className="font-serif text-2xl text-white italic">
              Parameters.
            </h2>
            <p className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest mt-2">
              Manual Control Deck
            </p>
          </div>

          <div className="p-6 space-y-10">
            {/* Auth banners */}
            {needsWallet && (
              <div className="border border-[var(--border)] p-4 font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest">
                Connect your wallet to initialize.
              </div>
            )}
            {needsAuth && (
              <div className="border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4 space-y-3">
                <span className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest block">
                  Authentication required:
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={signIn}
                  disabled={signingIn}
                >
                  {signingIn ? "Signing..." : "Sign In With Solana"}
                </Button>
                {authError && (
                  <p className="font-mono text-[10px] text-[var(--danger)]">
                    {authError}
                  </p>
                )}
              </div>
            )}

            {/* Template */}
            <div className="space-y-4">
              <label className="font-mono text-[10px] text-[var(--accent)] uppercase tracking-widest border-b border-[var(--border)] pb-2 block">
                System Template
              </label>
              <TemplateSelector value={templateId} onChange={handleTemplateChange} />
            </div>

            {/* Seed */}
            <div className="space-y-4">
              <label className="font-mono text-[10px] text-[var(--accent)] uppercase tracking-widest border-b border-[var(--border)] pb-2 block">
                Global Seed
              </label>
              <SeedInput seed={seed} onChange={setSeed} />
            </div>

            {/* Palette */}
            <div className="space-y-4">
              <label className="font-mono text-[10px] text-[var(--accent)] uppercase tracking-widest border-b border-[var(--border)] pb-2 block">
                Color Matrix
              </label>
              <PaletteEditor palette={palette} onChange={setPalette} />
            </div>

            {/* Sliders */}
            <div className="space-y-4">
              <label className="font-mono text-[10px] text-[var(--accent)] uppercase tracking-widest border-b border-[var(--border)] pb-2 block">
                Variables
              </label>
              <ParameterSliders
                templateId={templateId}
                params={params}
                onChange={setParams}
              />
            </div>

            {/* Title + Mint */}
            <div className="pt-6 border-t border-[var(--border)] space-y-4">
              <Input
                placeholder={`Artwork Designation // ${seed}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
              <MintButton onMint={handleMint} disabled={!authenticated} />
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div
          className="flex-1 bg-[var(--bg)] relative flex items-center justify-center p-8"
          style={{
            backgroundImage:
              "url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')",
          }}
        >
          <div className="w-full max-w-[700px] aspect-square bg-[#050505] border border-[var(--border)] relative overflow-hidden flex items-center justify-center">
            <div className="absolute top-4 left-4 font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest mix-blend-difference z-20">
              Live Preview // [{templateId}]
            </div>
            <img
              src={previewSrc}
              alt={`${templateId} preview`}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
