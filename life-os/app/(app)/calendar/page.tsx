import { EmptyState } from "@/ui";

// Skeleton onesto della rotta Calendario (stub 05).

export const metadata = { title: "Calendario — LifeOS" };

export default function CalendarPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="pt-2">
        <p className="em-eyebrow">Modulo</p>
        <h1 className="em-title-lg mt-1 text-[var(--em-text)]">Calendario</h1>
      </header>
      <section className="em-card p-5">
        <EmptyState
          heading="Il modulo Calendario non è ancora qui"
          text="Vista mese, striscia della settimana, eventi locali e agenda unificata arrivano con il modulo Calendario."
        />
      </section>
    </div>
  );
}
