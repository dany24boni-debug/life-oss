"use client";

/**
 * Selettore del tema in Impostazioni (run-05 prompt 6, D5): scuro (il
 * default), chiaro, o sistema. Preferenza PER-DISPOSITIVO (localStorage,
 * mai sincronizzata — documentato in theme.ts). RadioGroup Ember: tre
 * opzioni con descrizione, arrow-key nav di serie.
 */

import { useSyncExternalStore } from "react";
import { RadioGroup } from "@/ui";
import {
  getServerThemeMode,
  getThemeMode,
  setThemeMode,
  subscribeTheme,
  type ThemeMode,
} from "../_components/theme";

export function ThemeSection() {
  const mode = useSyncExternalStore(
    subscribeTheme,
    getThemeMode,
    getServerThemeMode,
  );

  return (
    <section aria-label="Tema" className="em-card p-5">
      <p className="em-eyebrow">Tema</p>
      <p className="em-body-sm mt-2 text-[var(--em-text-3)]">
        Vale per questo dispositivo: il telefono può restare scuro mentre
        il computer segue il sistema.
      </p>
      <div className="mt-3">
        <RadioGroup
          legend="Aspetto"
          value={mode}
          onChange={(v) => setThemeMode(v as ThemeMode)}
          options={[
            {
              value: "dark",
              label: "Scuro",
              description: "Il default di LifeOS: fondo grafite, sempre.",
            },
            {
              value: "light",
              label: "Chiaro",
              description: "Calce e inchiostro, per la luce del giorno.",
            },
            {
              value: "system",
              label: "Sistema",
              description: "Segue l'aspetto del dispositivo, anche quando cambia.",
            },
          ]}
        />
      </div>
    </section>
  );
}
