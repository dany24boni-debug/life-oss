import { FocusScreen } from "./focus-screen";

/**
 * /focus (run-08 prompt 5) — il timer pomodoro: durate configurabili,
 * ±1 minuto in corsa, chime a fine fase, e un timer WAKE/RELOAD-SAFE
 * per costruzione (lib/focus/engine.ts: lo stato persistito è
 * {fase, partenza, durata} e il tempo è sempre la differenza da
 * adesso). Le fasi di lavoro concluse finiscono nel registro
 * FocusSession (lo_focus_sessions) e contano nella streak globale.
 */

export const metadata = { title: "Focus — LifeOS" };

export default function FocusPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="pt-2">
        <p className="em-eyebrow">Modulo</p>
        <h1 className="em-title-lg mt-1 text-[var(--em-text)]">Focus</h1>
      </header>
      <FocusScreen />
    </div>
  );
}
