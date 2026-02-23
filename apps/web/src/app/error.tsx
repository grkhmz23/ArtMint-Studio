"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console for debugging
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="noise-overlay" />

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-xl w-full text-center space-y-8">
          {/* Error Code */}
          <div className="relative">
            <span className="font-serif text-[150px] md:text-[200px] leading-none text-[var(--danger)] opacity-10 select-none">
              500
            </span>
            <div className="absolute inset-0 flex items-center justify-center">
              <AlertTriangle size={64} className="text-[var(--danger)]" />
            </div>
          </div>

          {/* Message */}
          <div className="space-y-4">
            <h1 className="font-serif text-4xl md:text-5xl text-white">
              Something Went Wrong
            </h1>
            <p className="font-mono text-sm text-[var(--text-dim)] max-w-md mx-auto">
              We encountered an unexpected error. Please try again or contact
              support if the problem persists.
            </p>
          </div>

          {/* Error Details (dev mode only) */}
          {process.env.NODE_ENV === "development" && (
            <div className="p-4 border border-[var(--danger)]/30 bg-[var(--danger)]/5 text-left">
              <div className="flex items-center gap-2 mb-2 text-[var(--danger)]">
                <Bug size={14} />
                <span className="font-mono text-[10px] uppercase tracking-widest">
                  Error Details (Development Only)
                </span>
              </div>
              <p className="font-mono text-xs text-[var(--danger)] break-all">
                {error.message}
              </p>
              {error.digest && (
                <p className="font-mono text-[10px] text-[var(--text-dim)] mt-2">
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              onClick={reset}
              className="flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-black font-mono text-xs uppercase tracking-widest hover:bg-[var(--accent-hover)] transition-colors w-full sm:w-auto justify-center"
            >
              <RefreshCw size={14} />
              Try Again
            </button>
            <Link
              href="/"
              className="flex items-center gap-2 px-6 py-3 border border-[var(--border)] text-white font-mono text-xs uppercase tracking-widest hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors w-full sm:w-auto justify-center"
            >
              <Home size={14} />
              Back to Home
            </Link>
          </div>

          {/* Support */}
          <div className="pt-8 border-t border-[var(--border)]">
            <p className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest mb-4">
              Need Help?
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://twitter.com/artmintstudio"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
              >
                Contact on Twitter/X
              </a>
              <span className="hidden sm:block text-[var(--border)]">•</span>
              <a
                href="mailto:support@artmint.studio"
                className="font-mono text-xs text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
              >
                Email Support
              </a>
              <span className="hidden sm:block text-[var(--border)]">•</span>
              <Link
                href="/docs"
                className="font-mono text-xs text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
              >
                Documentation
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
