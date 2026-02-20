"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/Header";
import { TemplateSelector } from "@/components/studio/TemplateSelector";
import { SeedInput } from "@/components/studio/SeedInput";
import { PaletteEditor } from "@/components/studio/PaletteEditor";
import { ParameterSliders } from "@/components/studio/ParameterSliders";
import { MintButton } from "@/components/studio/MintButton";
import { useAuth } from "@/lib/use-auth";
import { useWallet } from "@solana/wallet-adapter-react";
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

  // Build render URL for the ArtPreview img tag
  const previewSrc = useMemo(() => {
    const data = encodeURIComponent(
      JSON.stringify({
        templateId,
        seed,
        palette,
        params,
        format: "svg",
      })
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
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 flex-shrink-0 overflow-y-auto border-r border-border bg-card p-4 space-y-5">
          <h2 className="text-sm font-semibold text-foreground">Parameter Editor</h2>

          {needsWallet && (
            <div className="rounded-lg border border-accent/30 bg-accent/10 p-3 text-xs text-muted">
              Connect your wallet to start creating.
            </div>
          )}

          {needsAuth && (
            <div className="rounded-lg border border-accent/30 bg-accent/10 p-3 text-xs space-y-2">
              <span className="text-muted">Sign in to mint:</span>
              <button
                className="block w-full rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white"
                onClick={signIn}
                disabled={signingIn}
              >
                {signingIn ? "Signing..." : "Sign In With Solana"}
              </button>
              {authError && <p className="text-danger text-[11px]">{authError}</p>}
            </div>
          )}

          <TemplateSelector value={templateId} onChange={handleTemplateChange} />
          <SeedInput seed={seed} onChange={setSeed} />
          <PaletteEditor palette={palette} onChange={setPalette} />
          <ParameterSliders templateId={templateId} params={params} onChange={setParams} />

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted">Title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`ArtMint #${seed}`}
              className="w-full h-8 px-2 rounded-md border border-border bg-background text-foreground text-sm"
              maxLength={200}
            />
          </div>

          <MintButton onMint={handleMint} disabled={!authenticated} />
        </aside>

        {/* Preview */}
        <main className="flex-1 flex items-center justify-center bg-background overflow-auto p-6">
          <div className="w-full max-w-[600px] aspect-square rounded-lg overflow-hidden border border-border bg-[#0a0a0f]">
            <img
              src={previewSrc}
              alt={`${templateId} preview`}
              className="w-full h-full object-cover"
            />
          </div>
        </main>
      </div>
    </div>
  );
}
