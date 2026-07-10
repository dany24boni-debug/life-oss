import { createClient } from "@/lib/supabase/server";
import { EsamiScreen } from "./esami-screen";

/**
 * /esami (run-05 prompt 3, stub 15) — il modulo esami nuovo sui port
 * locali, che SOSTITUISCE la pagina legacy (grep di supersessione nel
 * report). Guest-first: esami e pacing vivono in Dexie; l'auth serve solo
 * all'importer (i dati vecchi stanno sul server) e al sync. Il pacing
 * riusa la lib pura `lib/esami/pacing` della pagina legacy, read-only.
 */

export const metadata = { title: "Esami — LifeOS" };

export default async function EsamiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col gap-6">
      <header className="pt-2">
        <p className="em-eyebrow">Modulo</p>
        <h1 className="em-title-lg mt-1 text-[var(--em-text)]">Esami</h1>
      </header>
      <EsamiScreen authed={user !== null} />
    </div>
  );
}
