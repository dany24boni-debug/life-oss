"use client";

/**
 * Bottone dell'import spese legacy (run-05 prompt 4, B3.6): stesso
 * pattern degli altri. Usato da Impostazioni e dal prompt inline su
 * /spese a lista vuota (solo autenticati).
 */

import { useState } from "react";
import { Button, useToast } from "@/ui";
import { getDb } from "@/data/db";
import { fetchLegacySpese } from "./import-actions";
import { buildSpeseImportPlan } from "./importer";
import { runSpeseImportPlan } from "./import-run";

export function SpeseImportButton({ compact }: { compact?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const legacy = await fetchLegacySpese();
      if (!legacy.ok) {
        toast.show({
          message:
            "Non ho potuto leggere le vecchie spese. Controlla di avere l'accesso e riprova.",
          tone: "error",
        });
        return;
      }
      if (legacy.expenses.length === 0) {
        toast.show({
          message: "Nella vecchia pagina non ci sono spese da importare.",
        });
        return;
      }
      const plan = await buildSpeseImportPlan(legacy.expenses);
      const summary = await runSpeseImportPlan(getDb(), plan);
      toast.show({
        message:
          summary.expenses === 0
            ? "Già tutto importato: nessuna spesa nuova."
            : `Importate ${summary.expenses} spese dalla vecchia pagina.`,
        tone: summary.expenses === 0 ? "neutral" : "success",
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
      Importa le vecchie spese
    </Button>
  );
}
