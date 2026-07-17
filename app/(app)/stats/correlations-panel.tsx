"use client";

/**
 * Le correlazioni native su /stats (run-12, PROP-stats-03/CROSS-06) —
 * quattro carte oneste sui 60 giorni conclusi: allenamento×abitudini,
 * focus×task, energia di Sera×task, aderenza dieta×peso. Ogni carta
 * dice la n; sotto la soglia dice "ancora pochi dati" invece di
 * inventare. Il legacy /insights resta congelato: qui è tutto
 * ricostruito sui moduli correnti.
 */

import { ChartFrame } from "@/ui";
import {
  useBodyRange,
  useCheckinHistory,
  useCompletionByDay,
  useDietConsumedByDay,
  useFocusMinutesByDay,
  useHabitCompletionByDay,
  useLatestBody,
  useSettings,
  useTrainedDays,
} from "@/data/hooks";
import { calorieTargetKcal } from "@/data/derived";
import type { IsoDay } from "@/data/schemas";
import { dayRange, shiftDay } from "@/data/streak";
import { APP_TIME_ZONE } from "../_components/tasks/logic";
import {
  MIN_BUCKET,
  correlationWindow,
  dietWeightLine,
  energyTasksLine,
  focusTasksLine,
  trainingHabitsLine,
  type CorrelationLine,
} from "./correlations";

export function CorrelationsPanel({ today }: { today: IsoDay }) {
  const w = correlationWindow(today);

  const habitDays = useHabitCompletionByDay(w.from, w.to, APP_TIME_ZONE);
  const trained = useTrainedDays(w.from, w.to);
  const tasks = useCompletionByDay(w.from, w.to);
  const focus = useFocusMinutesByDay(w.from, w.to);
  const checkins = useCheckinHistory(shiftDay(w.to, 1), 60);
  const consumed = useDietConsumedByDay(w.from, w.to);
  const weights = useBodyRange(w.from, w.to);
  const settings = useSettings();
  const latest = useLatestBody();

  const loading =
    habitDays === undefined ||
    trained === undefined ||
    tasks === undefined ||
    focus === undefined ||
    checkins === undefined ||
    consumed === undefined ||
    weights === undefined;

  let cards: Array<{ title: string; result: CorrelationLine | null; few: string }> = [];
  if (!loading) {
    const doneByDay = new Map(tasks.map((d) => [d.date, d.done] as const));
    const focusByDay = new Map(
      focus.map((d) => [d.date, d.minutes] as const),
    );
    const kcalTarget =
      settings === undefined || latest === undefined
        ? null
        : calorieTargetKcal(
            {
              weightKg: latest?.weight_kg ?? null,
              heightCm: settings.height_cm,
              birthYear: settings.birth_year,
              sex: settings.sex,
              activityLevel: settings.activity_level,
            },
            Number(today.slice(0, 4)),
            "maintain",
          );
    cards = [
      {
        title: "Allenamento × Abitudini",
        result: trainingHabitsLine(habitDays, new Set(trained)),
        few: `servono almeno ${MIN_BUCKET} giorni con e ${MIN_BUCKET} senza allenamento (con abitudini previste)`,
      },
      {
        title: "Focus × Task",
        result: focusTasksLine(dayRange(w.from, w.to), doneByDay, focusByDay),
        few: `servono almeno ${MIN_BUCKET} giorni con e ${MIN_BUCKET} senza focus`,
      },
      {
        title: "Energia di Sera × Task",
        result: energyTasksLine(
          checkins.flatMap((c) =>
            c.energy_1_5 !== null && c.date >= w.from
              ? [{ date: c.date, energy: c.energy_1_5 }]
              : [],
          ),
          doneByDay,
        ),
        few: `servono almeno ${MIN_BUCKET} serate con energia alta e ${MIN_BUCKET} con energia bassa`,
      },
      {
        title: "Dieta × Peso",
        result: dietWeightLine(consumed, weights, kcalTarget),
        few: "servono almeno 3 settimane aderenti e 3 no, ognuna con 4 giorni loggati e 2 pesate (e il profilo per il target)",
      },
    ];
  }

  return (
    <ChartFrame
      label="Correlazioni"
      title="I moduli si parlano"
      state={loading ? "loading" : "ready"}
      minHeight={160}
      caption="Confronti di medie sui 60 giorni conclusi (oggi escluso), mai statistiche inventate: ogni carta dichiara su quanti giorni parla."
    >
      <ul className="flex flex-col gap-3">
        {cards.map((c) => (
          <li key={c.title}>
            <p className="em-eyebrow">{c.title}</p>
            <p
              className={
                c.result
                  ? "em-body-sm mt-0.5 text-[var(--em-text)]"
                  : "em-body-sm mt-0.5 text-[var(--em-text-3)]"
              }
            >
              {c.result
                ? c.result.line
                : `Ancora pochi dati: ${c.few}.`}
            </p>
          </li>
        ))}
      </ul>
    </ChartFrame>
  );
}
