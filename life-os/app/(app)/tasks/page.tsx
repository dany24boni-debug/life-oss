import { EmptyState } from "@/ui";

// Skeleton onesto della rotta Task (stub 05): titolo + stato vuoto con il
// nome del modulo in arrivo. Nessun dato finto, nessun controllo nativo.

export const metadata = { title: "Task — LifeOS" };

export default function TasksPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="pt-2">
        <p className="em-eyebrow">Modulo</p>
        <h1 className="em-title-lg mt-1 text-[var(--em-text)]">Task</h1>
      </header>
      <section className="em-card p-5">
        <EmptyState
          heading="Il modulo Task non è ancora qui"
          text="Quick-add in linguaggio naturale, viste Oggi e Prossimi, riordino e undo arrivano con il modulo Task."
        />
      </section>
    </div>
  );
}
