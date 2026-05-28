"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Client-side fallback for Supabase magic links that come back via
// the IMPLICIT flow (admin/generate_link, older magic-link emails).
// The tokens land in window.location.hash like:
//   #access_token=...&refresh_token=...&expires_in=3600&token_type=bearer&type=magiclink
//
// Hash fragments are never sent to the server, so the server-side
// page.tsx can't see them. This component reads them in the browser,
// calls supabase.auth.setSession() to install the session into the
// HTTP-only cookies via the SSR client, then redirects to `next`.
//
// Mounted ONLY when the server-side handler had no `?code=` query
// parameter — so the hot path (PKCE flow) is server-side and fast,
// and this client work runs only for the implicit-flow fallback.

export function CallbackHashHandler({ next }: { next: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"working" | "error">("working");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function processHash() {
      // window.location.hash starts with "#"; strip it.
      const hash = typeof window !== "undefined"
        ? window.location.hash.slice(1)
        : "";
      if (!hash) {
        // Truly missing — no code in query, no hash either.
        router.replace("/login?error=missing_code");
        return;
      }
      const params = new URLSearchParams(hash);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      // Supabase may return an error in the hash instead of tokens
      // when the magic link is expired, already used, or otherwise
      // invalid. Surface that to the user via the /login error page
      // instead of a generic "missing_tokens".
      const errParam = params.get("error");
      const errDesc = params.get("error_description");
      if (errParam || errDesc) {
        const msg = errDesc ?? errParam ?? "unknown_auth_error";
        router.replace(`/login?error=${encodeURIComponent(msg)}`);
        return;
      }

      if (!access_token || !refresh_token) {
        // Hash had something, but neither tokens nor an error block.
        // Most likely cause: unsupported fragment shape. Expose the
        // raw key set (no values) so we can debug.
        const keys = [...params.keys()].join(",");
        router.replace(
          `/login?error=${encodeURIComponent("missing_tokens_hash_keys:" + keys)}`,
        );
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (cancelled) return;
      if (error) {
        setStatus("error");
        setErrorMsg(error.message);
        router.replace(
          `/login?error=${encodeURIComponent(error.message)}`,
        );
        return;
      }
      // Clear the hash from the URL before navigating away — the
      // tokens have been consumed (now in cookies); leaving them in
      // history is unnecessary leakage.
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
      router.replace(next);
    }

    void processHash();
    return () => {
      cancelled = true;
    };
  }, [next, router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div
        role="status"
        aria-live="polite"
        className="text-center text-sm text-text-secondary"
      >
        {status === "working" ? (
          <>
            <span className="block">Login in corso…</span>
            <span className="mt-1 block text-xs text-text-muted">
              Aspetta un attimo, sto creando la sessione.
            </span>
          </>
        ) : (
          <span className="block text-accent-bad">
            Errore: {errorMsg ?? "ignoto"}
          </span>
        )}
      </div>
    </main>
  );
}
