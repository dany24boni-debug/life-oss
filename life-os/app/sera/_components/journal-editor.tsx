"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { saveDiaryEntry } from "../actions";
import { parseDiaryDraft } from "@/lib/validation/local-storage";

// JournalEditor — markdown textarea for the /sera diary block.
//
// Behaviour:
//   - When viewDate === today AND scope is granted, the textarea is
//     editable. Auto-save runs on a 1.5s debounce + on blur.
//   - When viewDate < today, the textarea is read-only (past entries
//     can be viewed but not edited from /sera; that's a deliberate
//     V1 boundary).
//   - When scopeMissing is true, the textarea is replaced by a
//     re-auth banner that triggers the upgrade-consent flow.
//
// localStorage recovery:
//   - Key: "lifeos.diary.draft.<today>" — present only while the
//     user types and BEFORE the first successful save.
//   - On mount we prefer the draft over server initialContent.
//   - On first successful save we clear the draft. Subsequent edits
//     do NOT recreate it (per project decision — keeps recovery
//     scoped to "lost work before any save").

const LS_KEY_PREFIX = "lifeos.diary.draft.";
const DEBOUNCE_MS = 1500;

const PLACEHOLDERS = [
  "Com'è andata oggi?",
  "Una cosa che voglio ricordare di oggi…",
  "Domani voglio…",
] as const;

type Status = "idle" | "saving" | "saved" | "error";

type Props = {
  viewDate: string;
  today: string;
  initialContent: string;
  initialMood: string | null;
  scopeMissing: boolean;
  accountConnected: boolean;
};

export function JournalEditor({
  viewDate,
  today,
  initialContent,
  initialMood,
  scopeMissing,
  accountConnected,
}: Props) {
  const isToday = viewDate === today;
  const isEditable = isToday && accountConnected && !scopeMissing;

  const [content, setContent] = useState(initialContent);
  const [status, setStatus] = useState<Status>("idle");
  const [errorSlug, setErrorSlug] = useState<string | null>(null);
  const [hasSaved, setHasSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable per-mount placeholder pick (no flicker on re-render).
  // useState with lazy init keeps the value out of the ref-during-render
  // lint trap while staying constant across re-renders.
  const [placeholderIdx] = useState(
    () => Math.floor(Math.random() * PLACEHOLDERS.length),
  );

  // On mount: prefer localStorage draft when editing today.
  useEffect(() => {
    if (isEditable && typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(LS_KEY_PREFIX + today);
        const draft = parseDiaryDraft(raw);
        if (draft != null && draft !== initialContent) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setContent(draft);
        }
      } catch {
        // localStorage unavailable — fall back to server value.
      }
    }
    setHydrated(true);
    // initialContent intentionally not in deps: server value is
    // captured once at mount; subsequent server-side rerenders that
    // change initialContent should not blow away the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, isEditable]);

  // Cleanup pending timer on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, []);

  function persistDraft(value: string) {
    if (!isEditable || hasSaved) return;
    try {
      window.localStorage.setItem(LS_KEY_PREFIX + today, value);
    } catch {
      // Quota / incognito — silent.
    }
  }

  function clearDraft() {
    try {
      window.localStorage.removeItem(LS_KEY_PREFIX + today);
    } catch {
      // Ignore.
    }
  }

  async function doSave(value: string) {
    if (!isEditable) return;
    setStatus("saving");
    setErrorSlug(null);
    const fd = new FormData();
    fd.set("date", today);
    fd.set("content", value);
    if (initialMood) fd.set("mood", initialMood);

    const res = await saveDiaryEntry(fd);
    if (res.ok) {
      setStatus("saved");
      if (!hasSaved) setHasSaved(true);
      clearDraft();
    } else {
      setStatus("error");
      setErrorSlug(res.error);
    }
  }

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    setContent(next);
    persistDraft(next);
    setStatus("idle");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void doSave(next);
    }, DEBOUNCE_MS);
  }

  function onBlur() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (isEditable && content !== initialContent) {
      void doSave(content);
    }
  }

  // ── Render branches ──────────────────────────────────────

  if (!accountConnected) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-sm text-text-secondary">
          Collega prima Google da{" "}
          <Link href="/agenda" className="underline">
            Agenda
          </Link>
          , poi torna qui per scrivere il diario.
        </p>
      </div>
    );
  }

  if (scopeMissing) {
    return (
      <div className="rounded-xl border border-accent-energy/40 bg-accent-energy/5 p-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-accent-energy">
          Autorizza accesso al Diario
        </p>
        <p className="mt-2 text-sm text-text-primary">
          Il diario sta su Google Drive (cartella{" "}
          <code className="text-text-secondary">Life-OS/Diario/</code>). Serve
          un permesso aggiuntivo per scriverci sopra.
        </p>
        <Link
          href="/api/auth/google/start?upgrade=drive"
          className="mt-3 inline-flex items-center justify-center rounded-md bg-text-primary px-4 py-2 text-sm font-medium text-bg hover:opacity-90"
        >
          Autorizza Drive
        </Link>
        <p className="mt-2 text-[10px] text-text-muted">
          Permesso <code className="text-text-muted">drive.file</code> — vediamo
          solo i file creati dall&apos;app, non il resto del tuo Drive.
        </p>
      </div>
    );
  }

  const charCount = content.length;
  const placeholder = PLACEHOLDERS[placeholderIdx];
  const statusLabel = (() => {
    if (!hydrated) return "";
    if (status === "saving") return "Salvataggio…";
    if (status === "saved") return "Salvato su Drive";
    if (status === "error") {
      if (errorSlug === "drive_api_error") return "Errore Drive (riprovo al prossimo edit)";
      return `Errore: ${errorSlug ?? "ignoto"}`;
    }
    return "";
  })();

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs uppercase tracking-wider text-text-muted">
          {isToday ? "Diario di oggi" : `Diario del ${viewDate}`}
        </p>
        {!isToday ? (
          <Link href="/sera" className="text-xs text-text-secondary underline">
            Torna a oggi
          </Link>
        ) : null}
      </div>
      <textarea
        value={content}
        onChange={onChange}
        onBlur={onBlur}
        readOnly={!isEditable}
        placeholder={placeholder}
        rows={12}
        // Mirrors the server-side cap in saveDiaryEntry. Defence in
        // depth: client hint + server enforcement.
        maxLength={100_000}
        aria-label="Diario"
        aria-describedby="diary-counter"
        className="mt-3 w-full resize-y rounded-md border border-border bg-bg px-3 py-2 text-sm leading-6 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-info focus:ring-offset-2 focus:ring-offset-bg"
      />
      <div className="mt-2 flex items-baseline justify-between gap-3 text-[10px] uppercase tracking-wider text-text-muted">
        <span role="status" aria-live="polite" aria-atomic="true">
          {statusLabel}
        </span>
        <span id="diary-counter" className="tabular-nums">
          {charCount} caratteri
        </span>
      </div>
    </div>
  );
}
