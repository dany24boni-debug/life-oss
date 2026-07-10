"use client";

// Boundary d'errore del gruppo (app), stile Ember. Il retry usa
// unstable_retry (Next 16.2: ricarica dati e ri-renderizza il segmento —
// la doc lo raccomanda al posto di reset per il recupero). Copy errori
// per le regole B4: cosa è successo + come uscirne, niente codici nudi.

import { useEffect } from "react";
import { Button } from "@/ui";

export default function AppShellError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[lifeos] errore nella shell (app):", error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <div className="em-card w-full max-w-md p-6 text-center">
        <p className="em-eyebrow text-[var(--em-segnale-text)]">Errore</p>
        <h1 className="em-title mt-2 text-[var(--em-text)]">
          Qualcosa è andato storto
        </h1>
        <p className="em-body-sm mt-2 text-[var(--em-text-2)]">
          Non sono riuscito a caricare questa schermata. Riprova: di solito
          basta.
        </p>
        {error.digest ? (
          <p className="em-eyebrow mt-3">rif. {error.digest}</p>
        ) : null}
        <div className="mt-5">
          <Button variant="primary" block onClick={() => unstable_retry()}>
            Riprova
          </Button>
        </div>
      </div>
    </div>
  );
}
