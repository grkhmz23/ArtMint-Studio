"use client";

import Link from "next/link";
import { Header } from "@/components/Header";
import { FileQuestion, ArrowLeft, Home, Search } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="noise-overlay" />

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-xl w-full text-center space-y-8">
          {/* Error Code */}
          <div className="relative">
            <span className="font-serif text-[150px] md:text-[200px] leading-none text-[var(--text)] opacity-10 select-none">
              404
            </span>
            <div className="absolute inset-0 flex items-center justify-center">
              <FileQuestion size={64} className="text-[var(--accent)]" />
            </div>
          </div>

          {/* Message */}
          <div className="space-y-4">
            <h1 className="font-serif text-4xl md:text-5xl text-white">
              Page Not Found
            </h1>
            <p className="font-mono text-sm text-[var(--text-dim)] max-w-md mx-auto">
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
              Check the URL or navigate back to explore our gallery.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Link
              href="/"
              className="flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-black font-mono text-xs uppercase tracking-widest hover:bg-[var(--accent-hover)] transition-colors w-full sm:w-auto justify-center"
            >
              <Home size={14} />
              Back to Home
            </Link>
            <Link
              href="/explore"
              className="flex items-center gap-2 px-6 py-3 border border-[var(--border)] text-white font-mono text-xs uppercase tracking-widest hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors w-full sm:w-auto justify-center"
            >
              <Search size={14} />
              Explore Gallery
            </Link>
          </div>

          {/* Quick Links */}
          <div className="pt-8 border-t border-[var(--border)]">
            <p className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest mb-4">
              Popular Destinations
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/studio"
                className="font-mono text-xs text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
              >
                AI Studio
              </Link>
              <span className="text-[var(--border)]">•</span>
              <Link
                href="/collections"
                className="font-mono text-xs text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
              >
                Collections
              </Link>
              <span className="text-[var(--border)]">•</span>
              <Link
                href="/auctions"
                className="font-mono text-xs text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
              >
                Auctions
              </Link>
              <span className="text-[var(--border)]">•</span>
              <Link
                href="/offers"
                className="font-mono text-xs text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
              >
                Offers
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
