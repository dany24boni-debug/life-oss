import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/ui";
import { TodayTasks } from "./_components/tasks/today-section";

/**
 * Oggi — la home della shell nuova (stub 05). Tutto ciò che è a schermo è
 * VERO (regola B1): data reale nel fuso dell'utente, saluto dal
 * display_name del profilo; le sezioni dei moduli non ancora arrivati sono
 * EmptyState onesti, senza numeri finti né card che fingono di essere
 * funzioni. Il ponte "Vecchia dashboard" è a senso unico: la dashboard
 * legacy non viene toccata (il link di ritorno arriva col prompt 15).
 *
 * Nota: a differenza delle pagine legacy, qui NON c'è il redirect a
 * /onboarding — l'onboarding appartiene al mondo vecchio; il profilo può
 * anche non esserci ancora e la pagina degrada con grazia.
 */

const SECTIONS: Array<{
  eyebrow: string;
  heading: string;
  text: string;
}> = [
  {
    eyebrow: "Agenda",
    heading: "Nessun evento in agenda",
    text: "Arriva con il modulo Calendario.",
  },
  {
    eyebrow: "Palestra",
    heading: "Nessun allenamento qui, per ora",
    text: "Arriva con il modulo Palestra.",
  },
  {
    eyebrow: "Streak",
    heading: "La streak parte da qui",
    text: "Arriva con il modulo Statistiche.",
  },
];

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Il proxy protegge "/": arrivare qui senza utente significa proxy
  // mal configurato — stessa difesa in profondità delle pagine legacy.
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, timezone")
    .eq("id", user.id)
    .maybeSingle();

  const timeZone = profile?.timezone ?? "Europe/Rome";
  const displayName = profile?.display_name?.trim() || null;
  const dateLabel = formatTodayIt(new Date(), timeZone);

  return (
    <div className="flex flex-col gap-6">
      <header className="pt-2">
        <p className="em-eyebrow">{dateLabel}</p>
        <h1 className="em-title-lg mt-1 text-[var(--em-text)]">
          {displayName ? `Ciao, ${displayName}` : "Ciao"}
        </h1>
        <p className="mt-2">
          <Link
            href="/dashboard"
            className="em-body-sm text-[var(--em-text-3)] underline decoration-[var(--em-hairline-strong)] underline-offset-4 transition-colors duration-[var(--em-dur-control)] hover:text-[var(--em-text)]"
          >
            Vecchia dashboard
          </Link>
        </p>
      </header>

      {/* Sezione Task reale (run-03 prompt 1): port locale, FAB, undo. */}
      <TodayTasks />

      {SECTIONS.map((s) => (
        <section key={s.eyebrow} aria-label={s.eyebrow} className="em-card p-5">
          <p className="em-eyebrow">{s.eyebrow}</p>
          <EmptyState compact heading={s.heading} text={s.text} />
        </section>
      ))}
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
