import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { GoogleAgendaEvent } from "./calendar/agenda";
import { readGoogleBlock } from "./calendar/google-read";
import { InstallTodayCard } from "./_components/pwa-install";
import {
  UpcomingReminders,
  WhileAwayCard,
} from "./_components/reminders-cards";
import { APP_TIME_ZONE } from "./_components/tasks/logic";
import { TodayAdesso } from "./_components/today-adesso";
import { TodayBrief } from "./_components/today-brief";
import { TodayAgenda } from "./_components/today-agenda";
import { TodayFocus } from "./_components/today-focus";
import { TodayGym } from "./_components/today-gym";
import { TodayHabits } from "./_components/today-habits";
import { TodayTasks } from "./_components/tasks/today-section";
import { TodayTiles } from "./_components/today-tiles";

/**
 * Oggi — la home della shell nuova (stub 05). Tutto ciò che è a schermo è
 * VERO (regola B1): data reale nel fuso dell'utente, saluto dal
 * display_name del profilo; le sezioni dei moduli non ancora arrivati sono
 * EmptyState onesti, senza numeri finti né card che fingono di essere
 * funzioni. La dashboard legacy è stata ritirata (run-05 prompt 1):
 * /dashboard ora è solo un redirect a questa pagina.
 *
 * Nota: a differenza delle pagine legacy, qui NON c'è il redirect a
 * /onboarding — l'onboarding appartiene al mondo vecchio; il profilo può
 * anche non esserci ancora e la pagina degrada con grazia.
 */

// L'ultimo placeholder (Palestra) è caduto col run-04 prompt 10: da qui
// in poi ogni sezione di Oggi è un modulo vero.

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Oggi è pubblica (guest mode, prompt 07): senza utente si rende la
  // variante ospite — i dati vivono in IndexedDB sul dispositivo, il
  // profilo server semplicemente non esiste.

  let displayName: string | null = null;
  let timeZone = "Europe/Rome";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, timezone")
      .eq("id", user.id)
      .maybeSingle();
    timeZone = profile?.timezone ?? "Europe/Rome";
    displayName = profile?.display_name?.trim() || null;
  }
  const dateLabel = formatTodayIt(new Date(), timeZone);

  // Eventi Google per la sezione Agenda (run-04 prompt 09): sola lettura,
  // già nel fuso dell'app; da ospiti la lista è semplicemente vuota.
  const googleEvents: GoogleAgendaEvent[] = user
    ? (await readGoogleBlock(supabase, user.id, APP_TIME_ZONE)).events
    : [];

  return (
    <div className="flex flex-col gap-6">
      <header className="pt-2">
        <p className="em-eyebrow">{dateLabel}</p>
        <h1 className="em-title-lg mt-1 text-[var(--em-text)]">
          {displayName ? `Ciao, ${displayName}` : "Ciao"}
        </h1>
        {/* La riga del buongiorno (run-09 prompt 4): deterministica dai
            dati veri; rifinitura LLM solo con account e chiave server. */}
        <TodayBrief authed={Boolean(user)} />
        {/* Il ponte "Vecchia dashboard" è caduto (run-05 prompt 1): la
            destinazione ora è un redirect proprio qui. */}
        {!user ? (
          <p className="mt-2">
            <span className="em-body-sm text-[var(--em-text-3)]">
              I tuoi dati vivono su questo dispositivo.{" "}
              <Link
                href="/impostazioni"
                className="underline decoration-[var(--em-hairline-strong)] underline-offset-4 transition-colors duration-[var(--em-dur-control)] hover:text-[var(--em-text)]"
              >
                Account e sincronizzazione
              </Link>
            </span>
          </p>
        ) : null}
      </header>

      {/* Tile reali (run-03 prompt 4): task oggi, streak, settimana. */}
      <TodayTiles />

      {/* Strip abitudini (run-08 prompt 2): anelli, un tocco per loggare. */}
      <TodayHabits />

      {/* "Adesso" (run-08 prompt 4): lo slot corrente del piano attivo. */}
      <TodayAdesso />

      {/* Mini-launcher del pomodoro (run-08 prompt 5). */}
      <TodayFocus />

      {/* Promemoria scattati mentre eri via (run-03 prompt 5). */}
      <WhileAwayCard />

      {/* Sezione Task reale (run-03 prompt 1): port locale, FAB, undo. */}
      <TodayTasks />

      {/* Agenda reale (run-04 prompt 09): strip settimana + merge del
          giorno — eventi locali, task con orario, Google read-only. */}
      <TodayAgenda google={googleEvents} />

      {/* Palestra reale (run-04 prompt 10): stato di oggi + CTA. */}
      <TodayGym />

      {/* Rail "Prossimi": cosa suonerà ad app aperta (run-03 prompt 5). */}
      <UpcomingReminders />

      {/* Card gentile "Installa LifeOS" (run-05 prompt 2): compare dopo
          qualche visita, congedabile per sempre, mai in standalone. */}
      <InstallTodayCard />
    </div>
  );
}

/**
 * Data di oggi in italiano nel fuso dell'utente, es.
 * "venerdì 10 luglio 2026". Fuso non valido: fallback Europe/Rome.
 */
function formatTodayIt(now: Date, timeZone: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  try {
    return new Intl.DateTimeFormat("it-IT", { ...opts, timeZone }).format(now);
  } catch {
    return new Intl.DateTimeFormat("it-IT", {
      ...opts,
      timeZone: "Europe/Rome",
    }).format(now);
  }
}
