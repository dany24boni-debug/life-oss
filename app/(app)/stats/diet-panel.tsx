"use client";

/**
 * Il pannello Dieta di /stats (run-12, PROP-stats-02) — la dieta era
 * INVISIBILE alle statistiche: aderenza kcal (giorni nel ±10% del
 * target), hit-rate proteine e trend peso 30 giorni accanto. Stesse
 * derivazioni del giorno (/dieta, Sera): target dal profilo + ultima
 * pesata, decigrammi interi fino alla resa.
 */

import { ChartFrame } from "@/ui";
import {
  useBodyRange,
  useDietConsumedByDay,
  useLatestBody,
  useSettings,
} from "@/data/hooks";
import { calorieTargetKcal, proteinTargetG } from "@/data/derived";
import type { IsoDay } from "@/data/schemas";
import { shiftDay } from "@/data/streak";
import { weekBounds } from "./logic";

const KG_DELTA = new Intl.NumberFormat("it-IT", {
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
} as Intl.NumberFormatOptions);

export function DietPanel({ today }: { today: IsoDay }) {
  const week = weekBounds(today);
  const consumed = useDietConsumedByDay(week.from, week.to);
  const trendRange = { from: shiftDay(today, -29), to: today };
  const weights = useBodyRange(trendRange.from, trendRange.to);
  const settings = useSettings();
  const latest = useLatestBody();

  const loading =
    consumed === undefined ||
    weights === undefined ||
    settings === undefined ||
    latest === undefined;

  const kcalTarget = loading
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
  const protTargetDg = loading
    ? null
    : (() => {
        const g = proteinTargetG(latest?.weight_kg ?? null);
        return g === null ? null : g * 10;
      })();

  const logged = consumed ?? [];
  const kcalHit =
    kcalTarget === null
      ? null
      : logged.filter((d) => Math.abs(d.kcal - kcalTarget) <= kcalTarget * 0.1)
          .length;
  const protHit =
    protTargetDg === null
      ? null
      : logged.filter((d) => d.protein_dg >= protTargetDg).length;
  const weightDelta =
    (weights ?? []).length >= 2
      ? weights![weights!.length - 1].weight_kg - weights![0].weight_kg
      : null;

  const state = loading
    ? ("loading" as const)
    : logged.length === 0 && weightDelta === null
      ? ("empty" as const)
      : ("ready" as const);

  return (
    <ChartFrame
      label="Dieta"
      title="Aderenza della settimana"
      state={state}
      minHeight={120}
      emptyText="Nessun giorno loggato questa settimana e meno di due pesate negli ultimi 30 giorni."
      caption={
        kcalTarget === null
          ? "Senza profilo (peso, altezza, età, attività) niente target: qui compaiono solo i giorni loggati."
          : "Settimana in corso (lun -> dom); target kcal e proteine dal profilo, come in /dieta."
      }
    >
      <dl className="grid grid-cols-3 gap-3">
        <div>
          <dt className="em-eyebrow">±10% kcal</dt>
          <dd className="em-title em-num mt-0.5 text-[var(--em-text)]">
            {kcalHit === null
              ? "—"
              : `${kcalHit}/${logged.length}`}
          </dd>
          <dd className="em-body-sm text-[var(--em-text-3)]">
            {kcalHit === null ? "serve il profilo" : "giorni loggati"}
          </dd>
        </div>
        <div>
          <dt className="em-eyebrow">Proteine ok</dt>
          <dd className="em-title em-num mt-0.5 text-[var(--em-text)]">
            {protHit === null ? "—" : `${protHit}/${logged.length}`}
          </dd>
          <dd className="em-body-sm text-[var(--em-text-3)]">
            {protHit === null ? "serve una pesata" : "a obiettivo"}
          </dd>
        </div>
        <div>
          <dt className="em-eyebrow">Peso 30 g</dt>
          <dd className="em-title em-num mt-0.5 text-[var(--em-text)]">
            {weightDelta === null ? "—" : `${KG_DELTA.format(weightDelta)} kg`}
          </dd>
          <dd className="em-body-sm text-[var(--em-text-3)]">
            {weightDelta === null ? "servono 2 pesate" : "prima → ultima"}
          </dd>
        </div>
      </dl>
    </ChartFrame>
  );
}
