"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/Header";
import Link from "next/link";
import { ArrowLeft, Grid3X3, Heart, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";

interface CollectionItem {
  mintAddress: string;
  title: string;
  imageUrl: string;
  wallet: string;
  createdAt: string;
  type: "ai" | "code" | "upload";
}

interface Collection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  creatorWallet: string;
  featured: boolean;
  itemCount: number;
  createdAt: string;
  items: CollectionItem[];
}

export default function CollectionPage() {
  const params = useParams();
  const { publicKey } = useWallet();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const slug = params.slug as string;
  const isOwner = publicKey && collection?.creatorWallet === publicKey.toBase58();

  useEffect(() => {
    if (slug) fetchCollection();
  }, [slug]);

  const fetchCollection = async () => {
    try {
      const res = await fetch(`/api/collections/${slug}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCollection(data.collection);
    } catch (err) {
      console.error("Failed to load collection:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this collection? This cannot be undone.")) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/collections/${slug}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");
      window.location.href = "/collections";
    } catch (err) {
      alert("Failed to delete collection");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="font-mono text-sm text-[var(--text-dim)]">Loading...</div>
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="font-serif text-2xl text-white">Collection not found</div>
          <Link
            href="/collections"
            className="font-mono text-sm text-[var(--accent)] hover:underline"
          >
            Back to collections
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="noise-overlay" />

      <div className="max-w-[1600px] mx-auto w-full p-6 lg:p-12 space-y-8">
        {/* Back Link */}
        <Link
          href="/collections"
          className="inline-flex items-center gap-2 font-mono text-xs text-[var(--text-dim)] hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Collections
        </Link>

        {/* Collection Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-4xl text-white">{collection.name}</h1>
              {collection.featured && (
                <span className="px-2 py-1 bg-[var(--accent)] text-black text-[10px] font-mono uppercase tracking-wider">
                  Featured
                </span>
              )}
            </div>
            {collection.description && (
              <p className="font-mono text-sm text-[var(--text-dim)] max-w-2xl">
                {collection.description}
              </p>
            )}
            <div className="flex items-center gap-4 font-mono text-[11px] text-[var(--text-dim)] uppercase tracking-wider">
              <span>By {collection.creatorWallet.slice(0, 6)}...{collection.creatorWallet.slice(-4)}</span>
              <span>•</span>
              <span>{collection.itemCount} items</span>
              <span>•</span>
              <span>Created {new Date(collection.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {isOwner && (
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-2 text-[var(--danger)] border-[var(--danger)] hover:bg-[var(--danger)] hover:text-white"
            >
              <Trash2 size={14} />
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          )}
        </div>

        {/* Items Grid */}
        {collection.items.length === 0 ? (
          <div className="text-center py-24 border border-[var(--border)] bg-[var(--bg-card)]">
            <Grid3X3 className="w-12 h-12 text-[var(--text-dim)] mx-auto mb-4" />
            <p className="font-mono text-sm text-[var(--text-dim)]">
              This collection is empty.
            </p>
            {isOwner && (
              <p className="font-mono text-xs text-[var(--text-dim)] mt-2">
                Add artworks from your profile.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {collection.items.map((item) => (
              <Link
                key={item.mintAddress}
                href={`/asset/${item.mintAddress}`}
                className="group block border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)] transition-colors"
              >
                <div className="aspect-square bg-[var(--bg)] overflow-hidden">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-3 space-y-1">
                  <h3 className="font-serif text-sm text-white truncate group-hover:text-[var(--accent)] transition-colors">
                    {item.title || "Untitled"}
                  </h3>
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5",
                        item.type === "ai" && "bg-purple-500/20 text-purple-400",
                        item.type === "code" && "bg-blue-500/20 text-blue-400",
                        item.type === "upload" && "bg-orange-500/20 text-orange-400"
                      )}
                    >
                      {item.type}
                    </span>
                    <span className="font-mono text-[9px] text-[var(--text-dim)]">
                      {item.wallet.slice(0, 4)}...{item.wallet.slice(-4)}
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
