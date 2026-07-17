"use client";

/**
 * Lo schermo di /dieta — tre tab:
 *   1. Oggi (default): i pasti del giorno dal piano attivo, un tap
 *      "Fatto", varianti, totali vs obiettivi, extra.
 *   2. Piano: l'authoring del piano settimanale (pasti e varianti).
 *   3. Alimenti: la libreria personale.
 */

import { useState } from "react";
import { Tabs } from "@/ui";
import { AlimentiTab } from "./alimenti-tab";
import { OggiTab } from "./oggi-tab";
import { PianoTab } from "./piano-tab";

const TAB_ITEMS = [
  { value: "oggi", label: "Oggi" },
  { value: "piano", label: "Piano" },
  { value: "alimenti", label: "Alimenti" },
];

export function DietaScreen() {
  const [tab, setTab] = useState("oggi");
  return (
    // La superficie diventa "wide" SOLO sul tab Piano (run-12 P5a,
    // PROP-diet-05): la larghezza si concede dove la griglia la spende;
    // Oggi e Alimenti restano alla misura di lettura di sempre.
    <div data-page-width={tab === "piano" ? "wide" : undefined}>
      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} label="Sezioni della dieta">
        {(active) =>
          active === "oggi" ? (
            <OggiTab onGoToPiano={() => setTab("piano")} />
          ) : active === "piano" ? (
            <PianoTab />
          ) : (
            <AlimentiTab />
          )
        }
      </Tabs>
    </div>
  );
}
