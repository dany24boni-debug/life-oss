import { Bricolage_Grotesque } from "next/font/google";
import { ToastProvider } from "@/ui";
import { MobileHeader, Rail, TabBar } from "./_components/app-nav";
import { RemindersHost } from "./_components/reminders-host";
import { SyncHost } from "./_components/sync-host";

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
      {/* Un solo ToastProvider per tutta la shell (run-03 prompt 5): i
          toast di moduli e promemoria condividono lo stesso stack. */}
      <ToastProvider>
        <Rail />
        <MobileHeader />
        <div className="md:pl-56">
          <main className="mx-auto w-full max-w-2xl px-5 pb-28 pt-2 md:max-w-3xl md:px-6 md:pb-10 md:pt-10">
            {children}
          </main>
        </div>
        <TabBar />
        {/* Scheduler in-app dei promemoria: vive finché la shell è aperta. */}
        <RemindersHost />
        {/* Sync engine (prompt 08): parte solo per utenti autenticati. */}
        <SyncHost />
      </ToastProvider>
    </div>
  );
}
