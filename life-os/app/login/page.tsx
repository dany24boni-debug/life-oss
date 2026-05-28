import { StatusPill } from "@/components/ui/status-pill";
import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  const sent = Boolean(params.sent);
  const error = typeof params.error === "string" ? decodeURIComponent(params.error) : null;

  return (
    <main className="relative flex min-h-screen flex-col px-6 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      {/* Subtle radial glow behind the form, to break the flat dark wall */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-10 -z-0 mx-auto h-[60vh] max-w-md rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(59,130,246,0.18), rgba(34,197,94,0.10) 45%, transparent 75%)",
        }}
      />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-10">
        <header className="space-y-3 text-center">
          <BrandMark />
          <div className="space-y-1.5">
            <h1 className="text-4xl font-semibold leading-none tracking-tight">Life OS</h1>
            <p className="text-sm text-text-secondary">
              Sign-in via magic link. Niente password, niente fronzoli.
            </p>
          </div>
        </header>

        {sent ? (
          <div className="rounded-xl border border-accent-good/40 bg-accent-good/5 p-4">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-good/15 text-accent-good"
              >
                ✓
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium text-text-primary">Link inviato</p>
                <p className="text-xs text-text-secondary">
                  Controlla la posta (anche spam). Tocca il link nell&apos;email e
                  finisci qui.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-accent-bad/40 bg-accent-bad/5 p-4"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-bad/15 text-accent-bad"
              >
                !
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium text-text-primary">Errore</p>
                <p className="break-words text-xs text-text-secondary">{error}</p>
              </div>
            </div>
          </div>
        ) : null}

        <form action={signIn} className="space-y-3">
          <label className="block space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              Email
            </span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="tu@esempio.com"
              className="w-full rounded-xl border border-border bg-surface px-4 py-3.5 text-base text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none focus:ring-2 focus:ring-accent-info/30"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-xl bg-text-primary px-4 py-3.5 text-base font-medium text-bg transition-opacity hover:opacity-90 active:opacity-80"
          >
            Invia magic link
          </button>
          <p className="text-center text-[11px] text-text-muted">
            Aprendo il link da iPhone, aggiungi Life OS alla home per usarlo come app.
          </p>
        </form>

        <footer className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.18em] text-text-muted">
          <StatusPill label="Beta" variant="live" />
          <span>·</span>
          <span>Personal Productivity OS</span>
        </footer>
      </div>
    </main>
  );
}

function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface text-3xl font-bold tracking-tight text-text-primary shadow-[0_0_40px_rgba(59,130,246,0.15)]"
    >
      L
    </span>
  );
}
