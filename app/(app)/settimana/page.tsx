import { SettimanaScreen } from "./settimana-screen";

/**
 * /settimana (run-08 prompt 4) — il planner settimanale: la settimana
 * tipo si scrive UNA volta (piani con slot orari per giorno) e si
 * spunta settimana dopo settimana; la storia resta e racconta cosa
 * salti più spesso. Guest-first: tutto locale, sincronizza con
 * l'account come il resto (lo_week_plans, lo_plan_slots,
 * lo_slot_checks).
 */

export const metadata = { title: "Settimana — LifeOS" };

export default function SettimanaPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="pt-2">
        <p className="em-eyebrow">Modulo</p>
        <h1 className="em-title-lg mt-1 text-[var(--em-text)]">Settimana</h1>
      </header>
      <SettimanaScreen />
    </div>
  );
}
