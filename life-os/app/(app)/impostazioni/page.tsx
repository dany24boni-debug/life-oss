import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/dashboard/actions";
import { Button } from "@/ui";

/**
 * Impostazioni — la superficie nuova del gruppo (app). Vive a
 * /impostazioni perché la legacy /settings (con /settings/goals e
 * /settings/targets) resta intatta e protetta (decisione collisioni di
 * night-01). Due varianti oneste:
 *   - ospite: spiegazione dei dati locali + CTA "Crea un account"
 *   - account: email, esci (riusa la server action esistente), e il ponte
 *     alle vecchie impostazioni — niente di finto, niente feature promesse.
 */

export const metadata = { title: "Impostazioni — LifeOS" };

export default async function ImpostazioniPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col gap-6">
      <header className="pt-2">
        <p className="em-eyebrow">Modulo</p>
        <h1 className="em-title-lg mt-1 text-[var(--em-text)]">Impostazioni</h1>
      </header>

      <section aria-label="Account" className="em-card p-5">
        <p className="em-eyebrow">Account</p>
        {user ? (
          <div className="mt-3 flex flex-col gap-4">
            <div>
              <p className="em-body text-[var(--em-text)]">{user.email}</p>
              <p className="em-body-sm mt-1 text-[var(--em-text-3)]">
                Hai un account. I dati dei moduli nuovi vivono per ora su
                questo dispositivo; la sincronizzazione arriva con una
                prossima versione.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <form action={signOut}>
                <Button type="submit">Esci</Button>
              </form>
              <Link
                href="/settings"
                className="em-body-sm text-[var(--em-text-3)] underline decoration-[var(--em-hairline-strong)] underline-offset-4 transition-colors duration-[var(--em-dur-control)] hover:text-[var(--em-text)]"
              >
                Vecchie impostazioni (obiettivi e target)
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            <div>
              <p className="em-body text-[var(--em-text)]">
                Stai usando LifeOS come ospite
              </p>
              <p className="em-body-sm mt-1 text-[var(--em-text-3)]">
                I tuoi dati vivono su questo dispositivo, dentro il browser:
                niente registrazione, niente rete. Un account servirà a
                sincronizzarli tra più dispositivi — quando creerai il tuo,
                quello che hai inserito qui verrà portato con te.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex h-[var(--em-control-h-md)] w-fit items-center justify-center rounded-[var(--em-r-md)] bg-[var(--em-ember)] px-4 text-[length:var(--em-fs-body)] font-semibold text-[var(--em-on-ember)] transition-[background] duration-[var(--em-dur-control)] hover:bg-[color-mix(in_srgb,var(--em-ember)_88%,var(--em-text))]"
            >
              Crea un account per sincronizzare
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
