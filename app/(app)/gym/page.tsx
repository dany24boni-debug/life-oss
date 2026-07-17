import { createClient } from "@/lib/supabase/server";
import { GymScreen } from "./gym-screen";

/**
 * /gym (B2.3, run-04 prompt 10) — il registro di allenamento nuovo, che
 * SOSTITUISCE la pagina legacy (decisione collisioni di night-01; grep di
 * supersessione nel report). Guest-first: libreria, piani, sessioni e
 * storico vivono in locale; l'auth serve solo all'import legacy (i dati
 * vecchi stanno sul server) e al sync.
 */

export const metadata = { title: "Palestra — LifeOS" };

export default async function GymPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    // Superficie "wide" (run-10 P3): griglia storica della scheda e
    // tabelle progressi spendono la colonna larga della shell.
    <div className="flex flex-col gap-6" data-page-width="wide">
      <header className="pt-2">
        <p className="em-eyebrow">Modulo</p>
        <h1 className="em-title-lg mt-1 text-[var(--em-text)]">Palestra</h1>
      </header>
      <GymScreen authed={user !== null} />
    </div>
  );
}
