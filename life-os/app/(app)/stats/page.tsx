import { EmptyState } from "@/ui";

// Skeleton onesto della rotta Statistiche (stub 05).

export const metadata = { title: "Statistiche — LifeOS" };

export default function StatsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="pt-2">
        <p className="em-eyebrow">Modulo</p>
        <h1 className="em-title-lg mt-1 text-[var(--em-text)]">Statistiche</h1>
      </header>
      <section className="em-card p-5">
        <EmptyState
          heading="Il modulo Statistiche non è ancora qui"
          text="Streak onesta con giorni protetti, barre della settimana e volume palestra arrivano con il modulo Statistiche."
        />
      </section>
    </div>
  );
}
