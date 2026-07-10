import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyCode } from "../actions";
import { ResendButton } from "./resend-button";

/**
 * Inserimento del codice OTP (B3.3): la seconda tappa di /login. Stato in
 * URL (email, error, sent) via redirect delle server action — la pagina
 * funziona anche senza JS e sopravvive al reload. Stile coerente con la
 * /login esistente (token legacy: questa superficie migrerà a Ember quando
 * migrerà tutto il flusso, non a metà).
 *
 * Scelta input (documentata per il brief): UN campo a 6 cifre invece di 6
 * caselle single-glyph — su iOS un campo unico con inputMode="numeric" +
 * autocomplete="one-time-code" è più robusto (paste naturale, niente
 * gestione focus tra caselle, autofill di sistema quando disponibile).
 * Niente maxLength: "123 456" incollato con lo spazio è accettato e
 * normalizzato dal server.
 */

export const metadata = { title: "Codice di accesso — Life OS" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string; sent?: string }>;
}) {
  const params = await searchParams;
  const email =
    typeof params.email === "string" ? params.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) redirect("/login");

  const error = typeof params.error === "string" ? params.error : null;
  const sent = Boolean(params.sent);

  return (
    <main className="relative flex min-h-screen flex-col px-6 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8">
        <header className="space-y-1.5 text-center">
          <h1 className="text-3xl font-semibold leading-none tracking-tight">
            Inserisci il codice
          </h1>
          <p className="text-sm text-text-secondary">
            Abbiamo inviato un&apos;email a{" "}
            <span className="font-medium text-text-primary">{email}</span>.
          </p>
        </header>

        {sent ? (
          <div className="rounded-xl border border-accent-good/40 bg-accent-good/5 p-4">
            <p className="text-sm text-text-primary">Email inviata.</p>
            <p className="mt-1 text-xs text-text-secondary">
              Se non arriva, controlla lo spam. Il codice vale pochi minuti.
            </p>
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-accent-bad/40 bg-accent-bad/5 p-4"
          >
            <p className="break-words text-sm text-text-primary">{error}</p>
          </div>
        ) : null}

        <form action={verifyCode} className="space-y-3">
          <input type="hidden" name="email" value={email} />
          <label className="block space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              Codice a 6 cifre
            </span>
            <input
              type="text"
              name="token"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              placeholder="000000"
              className="w-full rounded-xl border border-border bg-surface px-4 py-3.5 text-center text-2xl tabular-nums tracking-[0.4em] text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none focus:ring-2 focus:ring-accent-info/30"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-xl bg-text-primary px-4 py-3.5 text-base font-medium text-bg transition-opacity hover:opacity-90 active:opacity-80"
          >
            Accedi
          </button>
        </form>

        <div className="space-y-4 text-center">
          <p className="text-xs text-text-secondary">
            Nell&apos;email c&apos;è anche un link: aprirlo da{" "}
            <span className="font-medium text-text-primary">questo</span>{" "}
            dispositivo ti fa entrare direttamente, come prima.
          </p>
          <ResendButton email={email} />
          <p className="text-xs text-text-muted">
            Email sbagliata?{" "}
            <Link
              href="/login"
              className="underline underline-offset-4 hover:text-text-primary"
            >
              Torna indietro
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
