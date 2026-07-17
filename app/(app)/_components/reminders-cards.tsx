"use client";

/**
 * Le due superfici dei promemoria su Oggi (B2.2):
 *   - WhileAwayCard: "Mentre eri via" — gli scattati mai riconosciuti
 *     (anche quelli il cui toast è sfuggito), con Ok singolo e collettivo.
 *   - UpcomingReminders: il rail "Prossimi" — cosa suonerà nelle prossime
 *     24 ore, finché l'app resta aperta. Vuoto = invisibile, niente card
 *     che occupano spazio per dire nulla.
 */

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/ui";
import {
  appRepos,
  useFiredReminders,
  useUpcomingReminders,
} from "@/data/hooks";
import { instantToHhmm } from "@/lib/reminders/time";
import { IconBell } from "./icons";
import { APP_TIME_ZONE } from "./tasks/logic";

export function WhileAwayCard() {
  const toast = useToast();
  const fired = useFiredReminders();

  const items = (fired ?? []).filter((f) => f.task !== null);
  if (items.length === 0) return null;

  async function dismiss(ids: string[]) {
    const at = new Date().toISOString();
    for (const id of ids) {
      const r = await appRepos().reminders.dismiss(id, at);
      if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
    }
  }

  return (
    <section aria-label="Mentre eri via" className="em-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="em-eyebrow">Mentre eri via</p>
        {items.length > 1 ? (
          <button
            type="button"
            onClick={() => void dismiss(items.map((i) => i.reminder.id))}
            className="em-body-sm inline-flex min-h-[var(--em-tap-min)] items-center text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
          >
            Segna tutti letti
          </button>
        ) : null}
      </div>
      <ul className="mt-2 flex flex-col">
        {items.map(({ reminder, task }) => (
          <li
            key={reminder.id}
            className="flex min-h-[var(--em-tap-min)] items-center gap-3 border-b border-[var(--em-hairline)] py-1 last:border-b-0"
          >
            <span className="em-body-sm em-num w-12 shrink-0 text-[var(--em-text-3)]">
              {instantToHhmm(reminder.fire_at, APP_TIME_ZONE)}
            </span>
            <span className="em-body min-w-0 flex-1 truncate text-[var(--em-text)]">
              {task!.title}
            </span>
            <button
              type="button"
              onClick={() => void dismiss([reminder.id])}
              className="em-body-sm min-h-[var(--em-tap-min)] shrink-0 rounded-[var(--em-r-sm)] px-2.5 font-semibold text-[var(--em-ember-text)] transition-colors duration-[var(--em-dur-tap)] hover:bg-[var(--em-ember-tint)]"
            >
              Ok
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function UpcomingReminders() {
  // "Adesso" avanza col minuto: il rail non mostra promemoria già passati.
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());
  useEffect(() => {
    const iv = setInterval(() => setNowIso(new Date().toISOString()), 60_000);
    return () => clearInterval(iv);
  }, []);
  const toIso = useMemo(
    () => new Date(Date.parse(nowIso) + DAY_MS).toISOString(),
    [nowIso],
  );

  const upcoming = useUpcomingReminders(nowIso, toIso);
  const items = (upcoming ?? [])
    .filter((u) => u.reminder.fired_at === null && u.task !== null)
    .slice(0, 4);
  if (items.length === 0) return null;

  return (
    <section aria-label="Prossimi promemoria" className="em-card p-5">
      <div className="flex items-center gap-2">
        <IconBell className="h-4 w-4 text-[var(--em-text-3)]" />
        <p className="em-eyebrow">Prossimi</p>
      </div>
      <ul className="mt-2 flex flex-col">
        {items.map(({ reminder, task }) => (
          <li
            key={reminder.id}
            className="flex min-h-10 items-center gap-3 border-b border-[var(--em-hairline)] py-1 last:border-b-0"
          >
            <span className="em-body-sm em-num w-12 shrink-0 text-[var(--em-text-2)]">
              {instantToHhmm(reminder.fire_at, APP_TIME_ZONE)}
            </span>
            <span className="em-body-sm min-w-0 flex-1 truncate text-[var(--em-text)]">
              {task!.title}
            </span>
          </li>
        ))}
      </ul>
      <p className="em-body-sm mt-2 text-[var(--em-text-3)]">
        Suonano finché l&apos;app è aperta.
      </p>
    </section>
  );
}
