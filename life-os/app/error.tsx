"use client";

// Global error boundary. Triggered when any server or client component throws
// during render. Logs server-side via Next, surfaces a friendly page in
// Italian with a "Riprova" button that re-runs the segment.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[life-os] unhandled error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <span
          aria-hidden="true"
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-accent-bad/40 bg-accent-bad/10 text-3xl text-accent-bad"
        >
          !
        </span>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Qualcosa è andato storto</h1>
          <p className="text-sm text-text-secondary">
            Errore inatteso. Puoi riprovare o tornare al dashboard.
          </p>
          {error.digest ? (
            <p className="text-[10px] uppercase tracking-wider text-text-muted">
              ref: {error.digest}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-xl bg-text-primary px-4 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90"
          >
            Riprova
          </button>
          <a
            href="/dashboard"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-secondary transition-colors hover:border-text-muted hover:text-text-primary"
          >
            Torna al dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
