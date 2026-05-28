// Global 404 — fired when no route matches. Friendly Italian copy + a way
// back to the dashboard.

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <span
          aria-hidden="true"
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface text-3xl text-text-secondary"
        >
          ?
        </span>
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            404
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Pagina non trovata</h1>
          <p className="text-sm text-text-secondary">
            Il link che hai seguito non esiste o è stato spostato.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-block w-full rounded-xl bg-text-primary px-4 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90"
        >
          Torna al dashboard
        </Link>
      </div>
    </main>
  );
}
