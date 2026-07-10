"use client";

/**
 * Bottone dell'import sera legacy (run-05 prompt 5, B3.6): stesso pattern
 * degli altri. Usato da Impostazioni e dal prompt inline su /sera a
 * modulo vuoto (solo autenticati).
 */

import { useState } from "react";
import { Button, useToast } from "@/ui";
import { getDb } from "@/data/db";
import { fetchLegacySera } from "./import-actions";
import { buildSeraImportPlan } from "./importer";
import { runSeraImportPlan } from "./import-run";

export function SeraImportButton({ compact }: { compact?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const legacy = await fetchLegacySera();
      if (!legacy.ok) {
        toast.show({
          message:
            "Non ho potuto leggere i vecchi check-in. Controlla di avere l'accesso e riprova.",
          tone: "error",
        });
        return;
      }
      if (legacy.checkins.length === 0) {
        toast.show({
          message: "Nella vecchia Sera non c'è niente da importare.",
        });
        return;
      }
      const plan = await buildSeraImportPlan(legacy.checkins);
      const summary = await runSeraImportPlan(getDb(), plan);
      toast.show({
        message:
          summary.checkins === 0
            ? "Già tutto importato: nessun check-in nuovo."
            : `Importati ${summary.checkins} check-in dalla vecchia Sera.`,
        tone: summary.checkins === 0 ? "neutral" : "success",
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
      Importa i vecchi check-in
    </Button>
  );
}
