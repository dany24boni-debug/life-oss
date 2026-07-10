"use client";

/**
 * Bottone dell'import legacy (B3.6): scarica le righe vecchie via server
 * action (RLS-scoped), costruisce il piano deterministico e lo scrive nei
 * port locali. Rilanciabile senza paura: id derivati → righe già presenti
 * saltate. Usato da Impostazioni e dal prompt inline quando lo storico è
 * vuoto (solo utenti autenticati: i dati legacy vivono sul server).
 */

import { useState } from "react";
import { Button, useToast } from "@/ui";
import { getDb } from "@/data/db";
import { fetchLegacyGymData } from "./import-actions";
import { buildImportPlan } from "./importer";
import { runImportPlan } from "./import-run";

export function GymImportButton({ compact }: { compact?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const legacy = await fetchLegacyGymData();
      if (!legacy.ok) {
        toast.show({
          message:
            "Non ho potuto leggere i dati del vecchio Gym. Controlla di avere l'accesso e riprova.",
          tone: "error",
        });
        return;
      }
      if (legacy.sessions.length === 0 && legacy.workouts.length === 0) {
        toast.show({ message: "Nel vecchio Gym non c'è niente da importare." });
        return;
      }
      const plan = await buildImportPlan({
        legacySessions: legacy.sessions,
        legacyWorkouts: legacy.workouts,
      });
      const summary = await runImportPlan(getDb(), plan);
      const total = summary.sessions + summary.sets + summary.exercises;
      toast.show({
        message:
          total === 0
            ? "Già tutto importato: nessuna riga nuova."
            : `Importate ${summary.sessions} sessioni, ${summary.exercises} esercizi nuovi e ${summary.sets} serie.`,
        tone: total === 0 ? "neutral" : "success",
        durationMs: 7000,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      size={compact ? "sm" : "md"}
      onClick={() => void run()}
      loading={busy}
    >
      Importa dal vecchio Gym
    </Button>
  );
}
