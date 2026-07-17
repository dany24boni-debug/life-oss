"use client";

/**
 * Le parti vive della sezione account/sync di Impostazioni (prompt 08):
 *
 *   - SyncStatusLine: la riga quieta con ultimo sync riuscito ed eventuale
 *     ultimo errore (da sync_meta: vera anche appena riaperta l'app).
 *   - DataButtons: esporta/importa il backup JSON di tutti i dati locali.
 *     Funziona da ospiti e da account — è la rete di sicurezza pre-gate.
 *   - SignOutControl: "Esci" apre un Modal Ember con la scelta B3.2 —
 *     mantieni i dati su questo dispositivo, oppure svuota (Dexie +
 *     cursori) e poi esci. Niente si cancella senza questa scelta.
 */

import { useRef, useState } from "react";
import { getDb } from "@/data/db";
import { useSyncInfo, useSyncStatus } from "@/data/hooks";
import { exportAll, importAll } from "@/data/sync/export";
import { wipeLocalDevice } from "@/data/sync/wipe";
import { signOut } from "@/lib/auth/actions";
import { Button, Modal, useToast } from "@/ui";

/* ── Stato sync ─────────────────────────────────────────────────────── */

function formatInstantIt(iso: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
  }).format(date);
  const time = new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return `${day}, ${time}`;
}

export function SyncStatusLine() {
  const status = useSyncStatus();
  const info = useSyncInfo();

  const line =
    status.enabled && status.status === "syncing"
      ? "Sincronizzazione in corso…"
      : info?.lastSyncAt
        ? `Ultima sincronizzazione: ${formatInstantIt(info.lastSyncAt)}.`
        : "Prima sincronizzazione in arrivo.";

  return (
    <div className="mt-1">
      <p className="em-body-sm text-[var(--em-text-3)]">
        I dati vivono su questo dispositivo e si sincronizzano con il tuo
        account in automatico. {line}
      </p>
      {info?.lastError ? (
        <p className="em-body-sm mt-1 text-[var(--em-segnale-text)]">
          {info.lastError}
        </p>
      ) : null}
    </div>
  );
}

/* ── Export / import JSON ───────────────────────────────────────────── */

export function DataButtons() {
  const { show } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | "export" | "import">(null);

  const onExport = async () => {
    setBusy("export");
    try {
      const envelope = await exportAll(getDb());
      const blob = new Blob([JSON.stringify(envelope, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lifeos-export-${envelope.exported_at.slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      show({
        message: "Non ho potuto preparare l'export. Riprova.",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  };

  const onImportFile = async (file: File) => {
    setBusy("import");
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        show({
          message: "Il file non è un JSON leggibile. Controlla di aver scelto un export LifeOS.",
          tone: "error",
        });
        return;
      }
      const result = await importAll(getDb(), parsed);
      if (!result.ok) {
        show({ message: result.error.message, tone: "error" });
        return;
      }
      const { applied, skipped, invalid } = result.data;
      const extra =
        invalid > 0
          ? invalid === 1
            ? " 1 riga non valida è stata ignorata."
            : ` ${invalid} righe non valide sono state ignorate.`
          : "";
      show({
        message:
          applied === 0
            ? `Niente da importare: avevi già tutto (${skipped === 1 ? "1 riga uguale o più nuova" : `${skipped} righe uguali o più nuove`}).${extra}`
            : `${applied === 1 ? "Importata 1 riga" : `Importate ${applied} righe`}. ${skipped === 1 ? "1 era già aggiornata qui" : `${skipped} erano già aggiornate qui`}.${extra}`,
        tone: applied === 0 ? "neutral" : "success",
        durationMs: 7000,
      });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        onClick={onExport}
        disabled={busy !== null}
        loading={busy === "export"}
      >
        Esporta backup JSON
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => fileRef.current?.click()}
        disabled={busy !== null}
        loading={busy === "import"}
      >
        Importa backup
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onImportFile(file);
        }}
      />
    </div>
  );
}

/* ── Uscita con scelta sui dati locali (B3.2) ───────────────────────── */

export function SignOutControl() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<null | "keep" | "wipe">(null);
  const { show } = useToast();

  const leaveKeeping = async () => {
    setBusy("keep");
    try {
      await signOut();
    } finally {
      setBusy(null);
    }
  };

  const leaveWiping = async () => {
    setBusy("wipe");
    try {
      await wipeLocalDevice(getDb());
      await signOut();
    } catch {
      show({
        message: "Non ho potuto svuotare il dispositivo. Riprova.",
        tone: "error",
      });
      setBusy(null);
    }
  };

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Esci
      </Button>
      <Modal
        open={open}
        onClose={() => (busy ? null : setOpen(false))}
        title="Prima di uscire"
        description="I tuoi dati sono già sincronizzati con l'account. Cosa faccio con la copia su questo dispositivo?"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              onClick={leaveKeeping}
              disabled={busy !== null}
              loading={busy === "keep"}
            >
              Mantieni i dati su questo dispositivo
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={leaveWiping}
              disabled={busy !== null}
              loading={busy === "wipe"}
            >
              Svuota questo dispositivo
            </Button>
          </div>
        }
      >
        <p className="em-body-sm text-[var(--em-text-3)]">
          Se questo è un dispositivo condiviso, &ldquo;Svuota&rdquo; rimuove
          tutto dal browser: al prossimo accesso i dati tornano
          dall&apos;account.
        </p>
      </Modal>
    </>
  );
}
