"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Next.js Error Boundary Caught:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-black text-white w-full">
      <div className="bg-red-900/50 border border-red-500 rounded-2xl p-8 max-w-2xl w-full flex flex-col gap-4">
        <h2 className="text-2xl font-bold text-red-400">🚨 Application Error Caught 🚨</h2>
        <p className="text-gray-300">
          The system encountered a fatal error. Please take a screenshot of this error and send it to the developer:
        </p>
        <div className="bg-black/50 p-4 rounded-xl font-mono text-sm text-red-300 overflow-x-auto whitespace-pre-wrap">
          {error.message || "Unknown error"}
          {"\n\n"}
          {error.stack || ""}
        </div>
        <button
          className="mt-4 px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold transition-colors w-fit"
          onClick={
            // Attempt to recover by trying to re-render the segment
            () => {
              localStorage.clear();
              window.location.reload();
            }
          }
        >
          Clear Cache & Reload System
        </button>
      </div>
    </div>
  );
}
