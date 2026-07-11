import { CorpoScreen } from "./corpo-screen";

/**
 * /corpo (run-07 prompt 4) — il peso corporeo del foglio, come modulo:
 * pesata di oggi a colpo di stepper, trend 7/30/90 con banda min-max,
 * storico. Guest-first: tutto locale, sincronizza con l'account come il
 * resto (lo_body). Nessun importer: nel DB legacy non è mai esistita
 * una tabella di pesi corporei (audit nel report del run-07).
 */

export const metadata = { title: "Corpo — LifeOS" };

export default function CorpoPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="pt-2">
        <p className="em-eyebrow">Modulo</p>
        <h1 className="em-title-lg mt-1 text-[var(--em-text)]">Corpo</h1>
      </header>
      <CorpoScreen />
    </div>
  );
}
