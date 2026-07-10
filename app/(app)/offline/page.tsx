import Link from "next/link";

/**
 * /offline — l'ultima spiaggia del service worker (run-05 prompt 2):
 * quando una navigazione manca sia la rete sia la cache, il SW serve
 * questa pagina (messa in cache a ogni install). Statica per costruzione:
 * nessun dato per-utente, così lo snapshot in cache vale per chiunque.
 * Copy onesta: i dati locali (IndexedDB) ci sono ancora — è la pagina
 * che non era mai stata visitata a mancare.
 */

export const dynamic = "force-static";

export const metadata = { title: "Offline — LifeOS" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
      <p className="em-eyebrow">Offline</p>
      <h1 className="em-title-lg text-[var(--em-text)]">
        Sei offline — i tuoi dati locali sono comunque qui
      </h1>
      <p className="em-body-sm max-w-md text-[var(--em-text-3)]">
        Questa pagina non era in cache. Le schermate già visitate
        continuano a funzionare: task, eventi e allenamenti vivono su
        questo dispositivo, non in rete.
      </p>
      <Link
        href="/"
        className="inline-flex h-[var(--em-control-h-md)] items-center justify-center rounded-[var(--em-r-md)] bg-[var(--em-surface-2)] px-4 text-[length:var(--em-fs-body)] font-medium text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline)] transition-shadow duration-[var(--em-dur-control)] hover:shadow-[0_0_0_1px_var(--em-hairline-strong)]"
      >
        Torna a Oggi
      </Link>
    </div>
  );
}
