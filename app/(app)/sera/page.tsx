import { createClient } from "@/lib/supabase/server";
import { hasDriveFileScope } from "@/lib/google/scope-check";
import { SeraScreen, type DriveState } from "./sera-screen";

/**
 * /sera (run-05 prompt 5, stub 15) — il check-in serale sui port locali,
 * che SOSTITUISCE la pagina legacy senza i suoi difetti auditati (niente
 * sezione "Domani" placeholder, niente fetch-30-render-2). Il diario ora
 * è LOCALE (guest-first, sincronizzato); su Drive ci va con l'export
 * esplicito che riusa la lib esistente — solo autenticati con lo scope
 * drive.file. Lettura account a LISTA (mai maybeSingle).
 */

export const metadata = { title: "Sera — LifeOS" };

export default async function SeraPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let drive: DriveState = "guest";
  if (user) {
    const { data: accounts } = await supabase
      .from("external_calendar_accounts")
      .select("scope")
      .eq("user_id", user.id)
      .eq("provider", "google");
    const list = (accounts ?? []) as Array<{ scope: string | null }>;
    if (list.length === 0) drive = "none";
    else if (list.some((a) => hasDriveFileScope(a.scope))) drive = "ready";
    else drive = "scope_missing";
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="pt-2">
        <p className="em-eyebrow">Modulo</p>
        <h1 className="em-title-lg mt-1 text-[var(--em-text)]">Sera</h1>
      </header>
      <SeraScreen authed={user !== null} drive={drive} />
    </div>
  );
}
