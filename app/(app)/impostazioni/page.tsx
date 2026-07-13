import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  IconChevronRight,
  IconExam,
  IconFocus,
  IconMeal,
  IconMoon,
  IconRepeat,
  IconScale,
  IconWallet,
  IconWeek,
} from "../_components/icons";
import { InstallSection } from "../_components/pwa-install";
import { CalendarImportButton } from "../calendar/import-button";
import { EsamiImportButton } from "../esami/import-button";
import { GymImportButton } from "../gym/import-button";
import { SeraImportButton } from "../sera/import-button";
import { SpeseImportButton } from "../spese/import-button";
import { DataButtons, SignOutControl, SyncStatusLine } from "./account-sync";
import { ProfileSection } from "./profile-section";
import { ProtectedDays } from "./protected-days";
import { ThemeSection } from "./theme-section";

/**
 * Moduli oltre le 5 tab (run-05, stub 15): questa lista è la loro casa su
 * mobile; sul desktop hanno la sezione "Moduli" del Rail. Cresce coi
 * prompt del run (Esami, poi Spese e Sera).
 */
const MODULE_LINKS: Array<{
  href: string;
  label: string;
  desc: string;
  icon: (props: { className?: string }) => React.ReactElement;
}> = [
  {
    href: "/abitudini",
    label: "Abitudini",
    desc: "Board del giorno, anelli e streak",
    icon: IconRepeat,
  },
  {
    href: "/settimana",
    label: "Settimana",
    desc: "La settimana tipo, spuntata slot per slot",
    icon: IconWeek,
  },
  {
    href: "/focus",
    label: "Focus",
    desc: "Pomodoro con registro dei minuti",
    icon: IconFocus,
  },
  {
    href: "/dieta",
    label: "Dieta",
    desc: "Pasti del giorno, piano e libreria alimenti",
    icon: IconMeal,
  },
  {
    href: "/esami",
    label: "Esami",
    desc: "Countdown e ritmo di studio per capitolo",
    icon: IconExam,
  },
  {
    href: "/spese",
    label: "Spese",
    desc: "Uscite del mese per categoria",
    icon: IconWallet,
  },
  {
    href: "/sera",
    label: "Sera",
    desc: "Check-in serale e diario",
    icon: IconMoon,
  },
  {
    href: "/corpo",
    label: "Corpo",
    desc: "Peso corporeo e trend",
    icon: IconScale,
  },
];

/**
 * Impostazioni — la superficie nuova del gruppo (app). Vive a
 * /impostazioni perché la legacy /settings (con /settings/goals e
 * /settings/targets) resta intatta e protetta (decisione collisioni di
 * night-01). Due varianti oneste:
 *   - ospite: spiegazione dei dati locali + CTA "Crea un account"
 *   - account: email, stato del sync (prompt 08), esci con la scelta B3.2
 *     sui dati locali, e il ponte alle vecchie impostazioni.
 * Per entrambe: la card "I tuoi dati" con export/import del backup JSON.
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
              {/* Riga quieta del sync (prompt 08): ultimo sync + errori. */}
              <SyncStatusLine />
            </div>
            <div className="flex items-center gap-3">
              {/* Esci con scelta B3.2: mantieni o svuota il dispositivo. */}
              <SignOutControl />
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

      {/* Moduli oltre le tab (run-05): la casa mobile dei moduli nuovi. */}
      <section aria-label="Moduli" className="em-card p-5">
        <p className="em-eyebrow">Moduli</p>
        <ul className="mt-2 flex flex-col">
          {MODULE_LINKS.map((m) => (
            <li key={m.href}>
              <Link
                href={m.href}
                className="flex min-h-11 items-center gap-3 rounded-[var(--em-r-md)] px-2 py-2 transition-colors duration-[var(--em-dur-control)] hover:bg-[color-mix(in_srgb,var(--em-text)_7%,transparent)]"
              >
                <m.icon className="shrink-0 text-[var(--em-text-2)]" />
                <span className="min-w-0 flex-1">
                  <span className="em-body block font-medium text-[var(--em-text)]">
                    {m.label}
                  </span>
                  <span className="em-body-sm block text-[var(--em-text-3)]">
                    {m.desc}
                  </span>
                </span>
                <IconChevronRight className="shrink-0 text-[var(--em-text-3)]" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Backup JSON (prompt 08, B2.6): esporta/importa tutti i dati
          locali. Vale per ospiti E account — la rete di sicurezza che il
          gate di Davide chiede PRIMA di applicare le migrazioni. */}
      <section aria-label="I tuoi dati" className="em-card p-5">
        <p className="em-eyebrow">I tuoi dati</p>
        <p className="em-body-sm mt-2 text-[var(--em-text-3)]">
          Un file JSON con tutto quello che c&apos;è su questo dispositivo:
          task, eventi, allenamenti, promemoria, impostazioni.
          L&apos;import non cancella mai niente — per ogni riga vince la
          versione più recente.
        </p>
        <div className="mt-3">
          <DataButtons />
        </div>
      </section>

      {/* Import dal vecchio Gym (run-04 prompt 10, B3.6): solo account —
          i dati legacy vivono sul server. Idempotente, rilanciabile. */}
      {user ? (
        <section aria-label="Importa dal vecchio Gym" className="em-card p-5">
          <p className="em-eyebrow">Vecchi allenamenti</p>
          <p className="em-body-sm mt-2 text-[var(--em-text-3)]">
            Porta qui le sessioni e gli esercizi registrati nel vecchio
            modulo Gym. Rilanciarlo non crea doppioni: le righe già
            importate vengono saltate.
          </p>
          <div className="mt-3">
            <GymImportButton />
          </div>
        </section>
      ) : null}

      {/* Import dalla vecchia Agenda (run-05 prompt 1, B3.6): stesso
          pattern del gym — solo account, idempotente, rilanciabile. */}
      {user ? (
        <section
          aria-label="Importa dalla vecchia Agenda"
          className="em-card p-5"
        >
          <p className="em-eyebrow">Vecchia agenda</p>
          <p className="em-body-sm mt-2 text-[var(--em-text-3)]">
            Porta nel Calendario gli eventi locali della vecchia Agenda
            (quelli di Google si risincronizzano da soli). Rilanciarlo non
            crea doppioni.
          </p>
          <div className="mt-3">
            <CalendarImportButton />
          </div>
        </section>
      ) : null}

      {/* Import dei vecchi esami (run-05 prompt 3, B3.6). */}
      {user ? (
        <section aria-label="Importa i vecchi esami" className="em-card p-5">
          <p className="em-eyebrow">Vecchi esami</p>
          <p className="em-body-sm mt-2 text-[var(--em-text-3)]">
            Porta qui gli esami del vecchio modulo, con capitoli e note.
            Rilanciarlo non crea doppioni.
          </p>
          <div className="mt-3">
            <EsamiImportButton />
          </div>
        </section>
      ) : null}

      {/* Import delle vecchie spese (run-05 prompt 4, B3.6). */}
      {user ? (
        <section aria-label="Importa le vecchie spese" className="em-card p-5">
          <p className="em-eyebrow">Vecchie spese</p>
          <p className="em-body-sm mt-2 text-[var(--em-text-3)]">
            Porta nel modulo Spese le uscite registrate nella vecchia
            pagina Finance. Rilanciarlo non crea doppioni; l&apos;archivio
            resta dov&apos;è.
          </p>
          <div className="mt-3">
            <SpeseImportButton />
          </div>
        </section>
      ) : null}

      {/* Import dei vecchi check-in serali (run-05 prompt 5, B3.6). */}
      {user ? (
        <section
          aria-label="Importa i vecchi check-in"
          className="em-card p-5"
        >
          <p className="em-eyebrow">Vecchie sere</p>
          <p className="em-body-sm mt-2 text-[var(--em-text-3)]">
            Porta qui i check-in della vecchia Sera (energia, umore,
            note). I diari già esportati restano su Drive. Un giorno già
            scritto qui non viene mai toccato.
          </p>
          <div className="mt-3">
            <SeraImportButton />
          </div>
        </section>
      ) : null}

      {/* Profilo per le stime derivate (run-07 prompt 4). */}
      <ProfileSection />

      {/* Tema per-dispositivo (run-05 prompt 6, D5). */}
      <ThemeSection />

      {/* Installa LifeOS (run-05 prompt 2): prompt nativo dove esiste,
          coaching iOS altrove; sparisce quando è già installata. */}
      <InstallSection />

      {/* Giorni protetti della streak (run-03 prompt 4, B2.5). */}
      <ProtectedDays />

      {/* Pannello di verità sulle notifiche (run-03 prompt 5, B2.2):
          esattamente quando LifeOS può avvisare — e quando non può. */}
      <section aria-label="Promemoria e notifiche" className="em-card p-5">
        <p className="em-eyebrow">Promemoria e notifiche</p>
        <p className="em-body-sm mt-2 text-[var(--em-text-3)]">
          Quando LifeOS può avvisarti, senza promesse:
        </p>
        <dl className="mt-3 flex flex-col gap-3">
          <div>
            <dt className="em-body font-medium text-[var(--em-text)]">
              App aperta
            </dt>
            <dd className="em-body-sm mt-0.5 text-[var(--em-text-3)]">
              Il promemoria arriva subito: una notifica in basso, con un
              breve suono quando il browser lo consente.
            </dd>
          </div>
          <div>
            <dt className="em-body font-medium text-[var(--em-text)]">
              Al ritorno
            </dt>
            <dd className="em-body-sm mt-0.5 text-[var(--em-text-3)]">
              Quello che è scattato mentre eri via ti aspetta su Oggi,
              nella card &ldquo;Mentre eri via&rdquo;.
            </dd>
          </div>
          <div>
            <dt className="em-body font-medium text-[var(--em-text)]">
              App chiusa
            </dt>
            <dd className="em-body-sm mt-0.5 text-[var(--em-text-3)]">
              Il web non può suonare da solo ad app chiusa. Per promemoria
              garantiti usa &ldquo;Esporta su Calendario&rdquo; dalla scheda
              del task: l&apos;allarme lo fa il calendario di sistema.
            </dd>
          </div>
          <div>
            <dt className="em-body font-medium text-[var(--em-text)]">
              Timer focus
            </dt>
            <dd className="em-body-sm mt-0.5 text-[var(--em-text-3)]">
              Il pomodoro suona a fine fase con l&apos;app aperta; se lo
              schermo era bloccato, il cambio di fase ti aspetta — col suo
              suono — appena torni. Il tempo non si perde mai: è calcolato,
              non contato.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
