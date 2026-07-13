import { DietaScreen } from "./dieta-screen";

/**
 * /dieta (run-09) — il piano alimentare settimanale con varianti, il
 * giorno che si spunta a un tocco per pasto, la libreria alimenti
 * PERSONALE (nessun database pubblico, per decisione) e gli extra.
 * Guest-first: tutto locale, sincronizza con l'account (lo_foods,
 * lo_diet_*, lo_meal_*).
 */

export const metadata = { title: "Dieta — LifeOS" };

export default function DietaPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="pt-2">
        <p className="em-eyebrow">Modulo</p>
        <h1 className="em-title-lg mt-1 text-[var(--em-text)]">Dieta</h1>
      </header>
      <DietaScreen />
    </div>
  );
}
