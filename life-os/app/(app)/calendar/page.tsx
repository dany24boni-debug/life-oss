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

export default async function CalendarPage(props: {
  searchParams: Promise<{ giorno?: string }>;
}) {
  const { giorno } = await props.searchParams;
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
      <CalendarScreen initialDay={initialDay} google={google} />
    </div>
  );
}
