import { AbitudiniScreen } from "./abitudini-screen";

/**
 * /abitudini (run-08 prompt 2) — la board quotidiana delle abitudini:
 * anelli animati, log a un tocco per specie (spunta / contatore /
 * quantità con chips), streak per-abitudine coi giorni protetti e i
 * giorni non previsti a fare ponte. Guest-first: tutto locale,
 * sincronizza con l'account come il resto (lo_habits, lo_habit_logs).
 * L'Acqua è seminata e il suo obiettivo segue il profilo (run-07).
 */

export const metadata = { title: "Abitudini — LifeOS" };

export default function AbitudiniPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="pt-2">
        <p className="em-eyebrow">Modulo</p>
        <h1 className="em-title-lg mt-1 text-[var(--em-text)]">Abitudini</h1>
      </header>
      <AbitudiniScreen />
    </div>
  );
}
