"use client";

/**
 * Lo schermo di /settimana — tre tab:
 *   1. Settimana: la board lun->dom del piano attivo, switcher
 *      ‹ questa settimana › (passato ancora spuntabile, futuro =
 *      anteprima del piano), slot in corso con l'ember dot.
 *   2. Piani: gestione e authoring veloce (PlanManager).
 *   3. Storico: barre delle ultime 8 settimane + "Salti più spesso".
 */

import { useEffect, useState } from "react";
import { Button, EmptyState, Skeleton, Tabs, cx } from "@/ui";
import { isoWeekOf, shiftIsoWeek, type IsoWeek } from "@/data/planner";
import {
  useActiveWeekPlan,
  useWeekBoard,
  useWeekStats,
} from "@/data/hooks";
import { APP_TIME_ZONE } from "../_components/tasks/logic";
import { useToday } from "../_components/tasks/screen-hooks";
import { IconChevronRight } from "../_components/icons";
import { PlanManager } from "./plan-manager";
import { completionPct, hhmmInZone, weekRangeLabel } from "./logic";
import { WeekBoard } from "./week-board";

const TAB_ITEMS = [
  { value: "board", label: "Settimana" },
  { value: "piani", label: "Piani" },
  { value: "storico", label: "Storico" },
];

export function SettimanaScreen() {
  const [tab, setTab] = useState("board");
  return (
    <Tabs items={TAB_ITEMS} value={tab} onChange={setTab}>
      {(active) =>
        active === "board" ? (
          <BoardTab onGoToPlans={() => setTab("piani")} />
        ) : active === "piani" ? (
          <div className="pt-4">
            <PlanManager />
          </div>
        ) : (
          <StoricoTab />
        )
      }
    </Tabs>
  );
}

/* ── Tab Settimana ───────────────────────────────────────────────────── */

function useNowHhmm(): string {
  const [now, setNow] = useState(() => hhmmInZone(new Date(), APP_TIME_ZONE));
  useEffect(() => {
    const tick = () => setNow(hhmmInZone(new Date(), APP_TIME_ZONE));
    const iv = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return now;
}

function BoardTab({ onGoToPlans }: { onGoToPlans: () => void }) {
  const today = useToday();
  const nowHhmm = useNowHhmm();
  // La settimana corrente deriva dal giorno civile (useToday, Europe/
  // Rome): niente Date impuri nel render — la lezione lint del run-07.
  const thisWeek = isoWeekOf(today);
  const [week, setWeek] = useState<IsoWeek | null>(null);
  const shownWeek = week ?? thisWeek;
  const plan = useActiveWeekPlan();
  const board = useWeekBoard(plan?.id ?? null, shownWeek);

  if (plan === undefined) {
    return (
      <div aria-busy="true" className="pt-4">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (plan === null) {
    return (
      <div className="pt-4">
        <EmptyState
          heading="Nessun piano attivo"
          text="Scrivi la settimana tipo una volta; poi la spunti, settimana dopo settimana."
          action={
            <Button type="button" variant="primary" onClick={onGoToPlans}>
              Crea un piano
            </Button>
          }
        />
      </div>
    );
  }

  const isFuture = shownWeek > thisWeek;
  const isCurrent = shownWeek === thisWeek;

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Settimana precedente"
            onClick={() => setWeek(shiftIsoWeek(shownWeek, -1))}
            className="grid h-11 w-11 place-items-center rounded-[var(--em-r-md)] text-[var(--em-text-2)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
          >
            <IconChevronRight className="rotate-180" />
          </button>
          <button
            type="button"
            aria-label="Settimana successiva"
            onClick={() => setWeek(shiftIsoWeek(shownWeek, 1))}
            className="grid h-11 w-11 place-items-center rounded-[var(--em-r-md)] text-[var(--em-text-2)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
          >
            <IconChevronRight />
          </button>
        </div>
        <div className="min-w-0 text-right">
          <p className="em-body truncate font-medium text-[var(--em-text)]">
            {isCurrent ? "Questa settimana" : weekRangeLabel(shownWeek)}
            <span className="em-body-sm em-num ml-2 text-[var(--em-text-3)]">
              {shownWeek}
            </span>
          </p>
          {isFuture ? (
            <p className="em-body-sm text-[var(--em-text-3)]">
              Anteprima del piano: si spunta quando arriva.
            </p>
          ) : !isCurrent ? (
            <button
              type="button"
              onClick={() => setWeek(null)}
              className="em-body-sm text-[var(--em-text-3)] underline decoration-[var(--em-hairline-strong)] underline-offset-4 transition-colors duration-[var(--em-dur-control)] hover:text-[var(--em-text)]"
            >
              Torna a questa settimana
            </button>
          ) : null}
        </div>
      </div>

      {board === undefined ? (
        <div aria-busy="true">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <WeekBoard
          board={board}
          isoWeek={shownWeek}
          today={today}
          nowHhmm={nowHhmm}
          editable={!isFuture}
        />
      )}
      <p className="em-body-sm text-[var(--em-text-3)]">
        Tocca il cerchio per &quot;fatto&quot;; tienilo premuto per
        &quot;saltato&quot;.
      </p>
    </div>
  );
}

/* ── Tab Storico ─────────────────────────────────────────────────────── */

function StoricoTab() {
  const today = useToday();
  const thisWeek = isoWeekOf(today);
  const plan = useActiveWeekPlan();
  const stats = useWeekStats(plan?.id ?? null, 8, thisWeek);

  if (plan === undefined || stats === undefined) {
    return (
      <div aria-busy="true" className="pt-4">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (plan === null) {
    return (
      <div className="pt-4">
        <EmptyState
          compact
          heading="Ancora nessuna storia"
          text="Con un piano attivo, qui vedrai completamento e slot che salti più spesso."
        />
      </div>
    );
  }

  const hasAny = stats.weeks.some((w) => w.total > 0);

  return (
    <div className="flex flex-col gap-6 pt-4">
      <section aria-label="Completamento per settimana" className="em-card p-5">
        <p className="em-eyebrow">Ultime 8 settimane</p>
        {!hasAny ? (
          <p className="em-body-sm mt-2 text-[var(--em-text-3)]">
            La prima settimana spuntata inaugura le barre.
          </p>
        ) : (
          <div className="mt-3 flex items-end gap-2" role="img" aria-label="Barre di completamento per settimana">
            {stats.weeks.map((w) => {
              const pct = completionPct(w.done, w.total);
              const isCurrent = w.isoWeek === thisWeek;
              return (
                <div key={w.isoWeek} className="flex flex-1 flex-col items-center gap-1">
                  <span className="em-body-sm em-num text-[var(--em-text-3)]">
                    {pct === null ? "—" : `${pct}%`}
                  </span>
                  <div className="flex h-20 w-full max-w-8 items-end rounded-[4px] bg-[color-mix(in_srgb,var(--em-text)_7%,transparent)]">
                    {pct !== null && pct > 0 ? (
                      <div
                        className="w-full rounded-[4px] bg-[var(--em-ember)]"
                        style={{ height: `${Math.max(6, pct)}%` }}
                      />
                    ) : null}
                  </div>
                  <span
                    className={cx(
                      "em-eyebrow",
                      isCurrent
                        ? "text-[var(--em-text)]"
                        : "text-[var(--em-text-3)]",
                    )}
                  >
                    {w.isoWeek.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section aria-label="Salti più spesso" className="em-card p-5">
        <p className="em-eyebrow">Salti più spesso</p>
        {stats.mostSkipped.length === 0 ? (
          <p className="em-body-sm mt-2 text-[var(--em-text-3)]">
            Niente da segnalare: nelle settimane chiuse non è rimasto
            indietro nulla.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col">
            {stats.mostSkipped.slice(0, 6).map((row, i) => (
              <li
                key={row.slot.id}
                className="flex items-center gap-3 border-b border-[var(--em-hairline)] py-2.5 last:border-b-0"
              >
                <span className="em-body-sm em-num w-14 shrink-0 text-[var(--em-text-3)]">
                  {row.slot.start_hhmm}
                </span>
                <span className="em-body min-w-0 flex-1 truncate font-medium text-[var(--em-text)]">
                  {row.slot.title}
                </span>
                <span className="em-body-sm shrink-0 text-[var(--em-text-3)]">
                  {i === 0 ? "ti scappa spesso · " : ""}
                  {row.missed} su {row.weeks}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
