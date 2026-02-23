"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global Error Boundary
 * 
 * Catches unhandled errors in the React component tree.
 * Logs errors and displays a user-friendly error message.
 */
export default function GlobalError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    // Log error to monitoring service
    logger.error("Unhandled React error", {
      digest: error.digest,
      component: "GlobalError",
    }, error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center">
          <svg 
            className="w-8 h-8 text-red-500" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-zinc-400">
            We apologize for the inconvenience. Our team has been notified.
          </p>
        </div>

        {process.env.NODE_ENV === "development" && (
          <div className="text-left bg-zinc-900 rounded-lg p-4 overflow-auto">
            <p className="text-xs text-zinc-500 mb-2">Error (development only):</p>
            <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap break-all">
              {error.message}
            </pre>
            {error.digest && (
              <p className="text-xs text-zinc-500 mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2 bg-white text-black rounded-lg font-medium hover:bg-zinc-200 transition-colors"
          >
            Try Again
          </button>
          <a
            href="/"
            className="px-6 py-2 bg-zinc-800 text-white rounded-lg font-medium hover:bg-zinc-700 transition-colors"
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}
