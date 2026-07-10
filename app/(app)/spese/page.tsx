import { createClient } from "@/lib/supabase/server";
import { SpeseScreen } from "./spese-screen";

/**
 * /spese (run-05 prompt 4, stub 15) — le uscite personali sui port
 * locali. NESSUNA collisione di rotta: la legacy /finance resta intatta e
 * protetta come ARCHIVIO read-only (D4) — il modulo nuovo copre solo il
 * flusso `personal_expenses`, e un link quieto porta all'archivio.
 * Guest-first; l'auth serve a importer e sync.
 */

export const metadata = { title: "Spese — LifeOS" };

export default async function SpesePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col gap-6">
      <header className="pt-2">
        <p className="em-eyebrow">Modulo</p>
        <h1 className="em-title-lg mt-1 text-[var(--em-text)]">Spese</h1>
      </header>
      <SpeseScreen authed={user !== null} />
    </div>
  );
}
