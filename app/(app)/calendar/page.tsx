import { createClient } from "@/lib/supabase/server";
import { APP_TIME_ZONE } from "../_components/tasks/logic";
import { CalendarScreen } from "./calendar-screen";
import { readGoogleBlock } from "./google-read";

/**
 * /calendar (B2.4, run-04 prompt 09) — la superficie di pianificazione:
 * mese custom, eventi locali (Dexie, anche da ospiti), agenda unificata,
 * blocco Google read-only per gli account. Il server fa SOLO letture
 * (audit A2: la pagina legacy inseriva un holder durante la GET — qui non
 * esiste nulla del genere) e gli account Google si leggono a LISTA (mai
 * `.maybeSingle()`).
 */

export const metadata = { title: "Calendario — LifeOS" };

/** Esiti del callback OAuth, inoltrati dal redirect di /agenda (run-05). */
const GOOGLE_ERROR_LABELS: Record<string, string> = {
  access_denied: "Hai annullato la connessione a Google. Nessun problema.",
  not_authenticated: "Sessione scaduta durante la connessione. Riprova.",
  missing_refresh_token:
    "Google non ha concesso l'accesso continuativo. Riprova: alla richiesta, conferma tutti i permessi.",
};
const GOOGLE_ERROR_FALLBACK =
  "Connessione a Google non riuscita. Riprova tra poco.";

export default async function CalendarPage(props: {
  searchParams: Promise<{
    giorno?: string;
    google_connected?: string;
    google_error?: string;
  }>;
}) {
  const { giorno, google_connected, google_error } = await props.searchParams;
  const initialDay =
    giorno !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(giorno) ? giorno : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Ospiti: nessun blocco Google, il calendario è tutto locale.
  const google = user
    ? await readGoogleBlock(supabase, user.id, APP_TIME_ZONE)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="pt-2">
        <p className="em-eyebrow">Modulo</p>
        <h1 className="em-title-lg mt-1 text-[var(--em-text)]">Calendario</h1>
      </header>

      {google_connected === "1" ? (
        <p
          role="status"
          className="em-body-sm rounded-[var(--em-r-md)] border border-[color-mix(in_srgb,var(--em-salvia)_40%,transparent)] bg-[color-mix(in_srgb,var(--em-salvia)_8%,transparent)] px-3 py-2 text-[var(--em-salvia)]"
        >
          Account Google collegato. Premi &ldquo;Sincronizza&rdquo; per
          importare gli eventi.
        </p>
      ) : null}
      {typeof google_error === "string" && google_error !== "" ? (
        <p
          role="alert"
          className="em-body-sm rounded-[var(--em-r-md)] border border-[color-mix(in_srgb,var(--em-segnale)_40%,transparent)] bg-[color-mix(in_srgb,var(--em-segnale)_8%,transparent)] px-3 py-2 text-[var(--em-segnale)]"
        >
          {GOOGLE_ERROR_LABELS[google_error] ?? GOOGLE_ERROR_FALLBACK}
        </p>
      ) : null}

      <CalendarScreen initialDay={initialDay} google={google} />
    </div>
  );
}
