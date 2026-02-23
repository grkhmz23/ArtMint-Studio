"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import Link from "next/link";
import { Plus, Grid3X3, FolderOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Collection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  creatorWallet: string;
  featured: boolean;
  itemCount: number;
  previewImages: string[];
  createdAt: string;
}

export default function CollectionsPage() {
  const { publicKey } = useWallet();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "", slug: "" });

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      const res = await fetch("/api/collections?limit=50");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCollections(data.collections);
    } catch (err) {
      console.error("Failed to load collections:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) return;

    setCreating(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create");
      }

      setShowCreate(false);
      setFormData({ name: "", description: "", slug: "" });
      fetchCollections();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create collection");
    } finally {
      setCreating(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="noise-overlay" />

      <div className="max-w-[1600px] mx-auto w-full p-6 lg:p-12 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <h1 className="font-serif text-4xl text-white">Collections</h1>
            <p className="font-mono text-sm text-[var(--text-dim)] max-w-xl">
              Curated groups of artworks. Create your own collections to organize 
              and showcase your creative journey.
            </p>
          </div>
          {publicKey && (
            <Button
              onClick={() => setShowCreate(!showCreate)}
              className="gap-2"
            >
              <Plus size={16} />
              Create Collection
            </Button>
          )}
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="border border-[var(--border)] bg-[var(--bg-card)] p-6 space-y-4">
            <h2 className="font-serif text-xl text-white">New Collection</h2>
            <form onSubmit={handleCreate} className="space-y-4 max-w-lg">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-2">
                  Name
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFormData({
                      ...formData,
                      name,
                      slug: generateSlug(name),
                    });
                  }}
                  placeholder="My Art Collection"
                  required
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-2">
                  Description
                </label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe your collection..."
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-2">
                  URL Slug
                </label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="my-collection"
                  pattern="[a-z0-9-]+"
                  required
                />
                <p className="font-mono text-[10px] text-[var(--text-dim)] mt-1">
                  artmint.studio/collection/{formData.slug || "your-slug"}
                </p>
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating..." : "Create Collection"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Collections Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border border-[var(--border)] bg-[var(--bg-card)]">
                <div className="aspect-video bg-[var(--bg)] animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-5 bg-[var(--bg)] animate-pulse w-2/3" />
                  <div className="h-3 bg-[var(--bg)] animate-pulse w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="text-center py-24 border border-[var(--border)] bg-[var(--bg-card)]">
            <FolderOpen className="w-12 h-12 text-[var(--text-dim)] mx-auto mb-4" />
            <p className="font-mono text-sm text-[var(--text-dim)]">
              No collections yet. Be the first to create one!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((collection) => (
              <Link
                key={collection.id}
                href={`/collection/${collection.slug}`}
                className="group block border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)] transition-colors"
              >
                {/* Preview Grid */}
                <div className="aspect-video bg-[var(--bg)] relative overflow-hidden">
                  {collection.previewImages.length > 0 ? (
                    <div className="grid grid-cols-2 h-full">
                      {collection.previewImages.slice(0, 4).map((img, i) => (
                        <img
                          key={i}
                          src={img}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ))}
                      {collection.previewImages.length < 4 &&
                        Array.from({ length: 4 - collection.previewImages.length }).map((_, i) => (
                          <div key={i} className="bg-[var(--bg)] border border-[var(--border)]" />
                        ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Grid3X3 className="w-12 h-12 text-[var(--text-dim)]" />
                    </div>
                  )}
                  {collection.featured && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-[var(--accent)] text-black text-[9px] font-mono uppercase tracking-wider">
                      Featured
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4 space-y-2">
                  <h3 className="font-serif text-lg text-white group-hover:text-[var(--accent)] transition-colors">
                    {collection.name}
                  </h3>
                  {collection.description && (
                    <p className="font-mono text-xs text-[var(--text-dim)] line-clamp-2">
                      {collection.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <span className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-wider">
                      By {collection.creatorWallet.slice(0, 4)}...
                      {collection.creatorWallet.slice(-4)}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--accent)]">
                      {collection.itemCount} items
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
