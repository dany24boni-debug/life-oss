"use client";

/**
 * Bottone dell'import agenda legacy (run-05 prompt 1, B3.6): scarica le
 * righe della vecchia /agenda via server action (RLS-scoped), costruisce
 * il piano deterministico e lo scrive nei port locali. Rilanciabile senza
 * paura: id derivati → righe già presenti saltate. Usato da Impostazioni
 * e dal prompt inline su /calendar a eventi vuoti (solo autenticati).
 */

import { useState } from "react";
import { Button, useToast } from "@/ui";
import { getDb } from "@/data/db";
import { fetchLegacyAgendaEvents } from "./import-actions";
import { buildAgendaImportPlan } from "./importer";
import { runAgendaImportPlan } from "./import-run";

export function CalendarImportButton({ compact }: { compact?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const legacy = await fetchLegacyAgendaEvents();
      if (!legacy.ok) {
        toast.show({
          message:
            "Non ho potuto leggere la vecchia Agenda. Controlla di avere l'accesso e riprova.",
          tone: "error",
        });
        return;
      }
      if (legacy.entries.length === 0) {
        toast.show({
          message: "Nella vecchia Agenda non c'è niente da importare.",
        });
        return;
      }
      const plan = await buildAgendaImportPlan(legacy.entries);
      const summary = await runAgendaImportPlan(getDb(), plan);
      toast.show({
        message:
          summary.events === 0
            ? "Già tutto importato: nessun evento nuovo."
            : `Importati ${summary.events} eventi dalla vecchia Agenda.`,
        tone: summary.events === 0 ? "neutral" : "success",
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
      Importa dalla vecchia Agenda
    </Button>
  );
}
