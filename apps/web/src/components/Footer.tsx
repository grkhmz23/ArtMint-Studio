"use client";

import Link from "next/link";
import { Github, Twitter, FileText, Shield, BookOpen, HelpCircle } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg)]">
      <div className="max-w-[1600px] mx-auto w-full p-6 lg:p-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-3 group no-underline">
              <div className="w-8 h-8 border border-[var(--text)] flex items-center justify-center group-hover:bg-[var(--text)] transition-colors">
                <span className="font-serif text-lg font-bold group-hover:text-black leading-none mt-1">
                  A
                </span>
              </div>
              <span className="font-serif text-xl tracking-wide text-[var(--text)]">
                ArtMint.
              </span>
            </Link>
            <p className="font-mono text-xs text-[var(--text-dim)] leading-relaxed">
              AI-powered generative art studio on Solana. Create, mint, and trade 
              deterministic artworks.
            </p>
          </div>

          {/* Platform */}
          <div className="space-y-4">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--text-dim)]">
              Platform
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/explore"
                  className="font-mono text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors no-underline"
                >
                  Explore
                </Link>
              </li>
              <li>
                <Link
                  href="/auctions"
                  className="font-mono text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors no-underline"
                >
                  Auctions
                </Link>
              </li>
              <li>
                <Link
                  href="/collections"
                  className="font-mono text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors no-underline"
                >
                  Collections
                </Link>
              </li>
              <li>
                <Link
                  href="/activity"
                  className="font-mono text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors no-underline"
                >
                  Activity
                </Link>
              </li>
            </ul>
          </div>

          {/* Create */}
          <div className="space-y-4">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--text-dim)]">
              Create
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/studio"
                  className="font-mono text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors no-underline"
                >
                  AI Studio
                </Link>
              </li>
              <li>
                <Link
                  href="/studio/code"
                  className="font-mono text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors no-underline"
                >
                  Live Coding
                </Link>
              </li>
              <li>
                <Link
                  href="/studio/manual"
                  className="font-mono text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors no-underline"
                >
                  Parameters
                </Link>
              </li>
              <li>
                <Link
                  href="/upload"
                  className="font-mono text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors no-underline"
                >
                  Upload
                </Link>
              </li>
            </ul>
          </div>

          {/* Account */}
          <div className="space-y-4">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--text-dim)]">
              Account
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/dashboard"
                  className="font-mono text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors no-underline"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/settings"
                  className="font-mono text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors no-underline"
                >
                  Settings
                </Link>
              </li>
              <li>
                <Link
                  href="/notifications"
                  className="font-mono text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors no-underline"
                >
                  Notifications
                </Link>
              </li>
              <li>
                <Link
                  href="/offers"
                  className="font-mono text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors no-underline"
                >
                  Offers
                </Link>
              </li>
            </ul>
          </div>

          {/* Documentation */}
          <div className="space-y-4">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--text-dim)]">
              Documentation
            </h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://github.com/your-repo/artmint-studio/blob/main/README.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors flex items-center gap-2 no-underline"
                >
                  <BookOpen size={14} />
                  README
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/your-repo/artmint-studio/blob/main/docs/MAINNET_DEPLOYMENT.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors flex items-center gap-2 no-underline"
                >
                  <FileText size={14} />
                  Deployment Guide
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/your-repo/artmint-studio/blob/main/SECURITY.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors flex items-center gap-2 no-underline"
                >
                  <Shield size={14} />
                  Security
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/your-repo/artmint-studio/blob/main/docs/FRONTEND_BACKEND_MAP.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors flex items-center gap-2 no-underline"
                >
                  <HelpCircle size={14} />
                  API Reference
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-[var(--border)] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-mono text-xs text-[var(--text-dim)]">
            © {new Date().getFullYear()} ArtMint Studio. All rights reserved.
          </p>
          
          <div className="flex items-center gap-4">
            <a
              href="https://twitter.com/artmintstudio"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 border border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
              aria-label="Twitter"
            >
              <Twitter size={16} />
            </a>
            <a
              href="https://github.com/your-repo/artmint-studio"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 border border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
              aria-label="GitHub"
            >
              <Github size={16} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
