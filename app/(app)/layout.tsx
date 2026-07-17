import { Bricolage_Grotesque } from "next/font/google";
import { ToastProvider } from "@/ui";
import { MobileHeader, Rail, TabBar } from "./_components/app-nav";
import { ComfortHost } from "./_components/comfort-host";
import { PwaHost } from "./_components/pwa-host";
import { RemindersHost } from "./_components/reminders-host";
import { SyncHost } from "./_components/sync-host";

/**
 * Tema per-dispositivo PRIMA del paint (run-05 prompt 6): lo scuro è il
 * default (nessun attributo), il chiaro si attiva stampando
 * data-ember-theme="light" su <html> — eseguito inline in testa alla
 * shell così un dispositivo in chiaro non vede il flash scuro. La logica
 * completa (set, listener di sistema, meta theme-color) vive in
 * _components/theme.ts; questo script ne è il riassunto sincrono.
 */
const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("lifeos.theme");var l=t==="light"||(t==="system"&&matchMedia("(prefers-color-scheme: light)").matches);if(l)document.documentElement.setAttribute("data-ember-theme","light")}catch(e){}`;

/**
 * Layout del gruppo (app) — la shell nuova (B3.5). Tutto dentro em-scope:
 * i token Ember valgono qui e SOLO qui, le rotte legacy fuori dal gruppo
 * restano intatte. Il font display Bricolage è legato qui via la variabile
 * --font-em-display che ui/ember.css legge con fallback Geist (stessa
 * convenzione di /dev/ui).
 */

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-em-display",
});

export default function AppShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${display.variable} em-scope min-h-dvh w-full`}>
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      {/* Un solo ToastProvider per tutta la shell (run-03 prompt 5): i
          toast di moduli e promemoria condividono lo stesso stack. */}
      <ToastProvider>
        <Rail />
        <MobileHeader />
        <div className="md:pl-56">
          {/* Larghezza della colonna: em-main (ui/ember.css, run-10 P3) —
              lettura di default, "wide" quando la pagina lo dichiara con
              data-page-width="wide" (settimana, gym, stats). */}
          <main className="em-main mx-auto w-full px-5 pb-28 pt-2 md:px-6 md:pb-10 md:pt-10">
            {children}
          </main>
        </div>
        <TabBar />
        {/* Scheduler in-app dei promemoria: vive finché la shell è aperta. */}
        <RemindersHost />
        {/* Sync engine (prompt 08): parte solo per utenti autenticati. */}
        <SyncHost />
        {/* Service worker + toast aggiornamento + install UX (run-05
            prompt 2). Registra solo in produzione; dev intatto. */}
        <PwaHost />
        {/* Palette comandi, scorciatoie e tema (run-05 prompt 6). */}
        <ComfortHost />
      </ToastProvider>
    </div>
  );
}
