"use client";

/**
 * Bottone dell'import esami legacy (run-05 prompt 3, B3.6): fetch via
 * server action (RLS-scoped), piano deterministico, scrittura nei port
 * locali. Rilanciabile senza paura. Usato da Impostazioni e dal prompt
 * inline su /esami a lista vuota (solo autenticati).
 */

import { useState } from "react";
import { Button, useToast } from "@/ui";
import { getDb } from "@/data/db";
import { fetchLegacyEsami } from "./import-actions";
import { buildEsamiImportPlan } from "./importer";
import { runEsamiImportPlan } from "./import-run";

export function EsamiImportButton({ compact }: { compact?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const legacy = await fetchLegacyEsami();
      if (!legacy.ok) {
        toast.show({
          message:
            "Non ho potuto leggere i vecchi esami. Controlla di avere l'accesso e riprova.",
          tone: "error",
        });
        return;
      }
      if (legacy.exams.length === 0) {
        toast.show({
          message: "Nel vecchio modulo Esami non c'è niente da importare.",
        });
        return;
      }
      const plan = await buildEsamiImportPlan(legacy.exams);
      const summary = await runEsamiImportPlan(getDb(), plan);
      toast.show({
        message:
          summary.exams === 0
            ? "Già tutto importato: nessun esame nuovo."
            : `Importati ${summary.exams} esami dal vecchio modulo.`,
        tone: summary.exams === 0 ? "neutral" : "success",
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
      Importa i vecchi esami
    </Button>
  );
}
