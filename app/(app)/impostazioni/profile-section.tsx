"use client";

/**
 * Profilo (run-07 prompt 4) — quattro numeri per le STIME derivate
 * (acqua e calorie, data/derived.ts, che il run-08 userà): altezza,
 * sesso, anno di nascita, livello di attività. Copy onesta: sono stime
 * di formula, non prescrizioni. Sincronizza con Settings (lo_settings).
 */

import { Input, Skeleton, cx, useToast } from "@/ui";
import { appRepos, useLatestBody, useSettings } from "@/data/hooks";
import {
  calorieTargetKcal,
  waterTargetMl,
} from "@/data/derived";
import type { Sex } from "@/data/schemas";
import { todayLocal } from "@/ui/calendar-core";

const ACTIVITY_LABELS = [
  "Sedentario",
  "Leggero",
  "Moderato",
  "Attivo",
  "Atleta",
] as const;

export function ProfileSection() {
  const toast = useToast();
  const settings = useSettings();
  const latest = useLatestBody();

  async function patch(input: {
    height_cm?: number | null;
    sex?: Sex | null;
    birth_year?: number | null;
    activity_level?: number | null;
  }) {
    const r = await appRepos().settings.update(input);
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  function parseIntOrNull(raw: string, min: number, max: number): number | null {
    const n = Number.parseInt(raw.trim(), 10);
    if (Number.isNaN(n)) return null;
    return Math.max(min, Math.min(max, n));
  }

  const todayYear = Number.parseInt(todayLocal().slice(0, 4), 10);
  const weightKg = latest?.weight_kg ?? null;
  const water = waterTargetMl(weightKg);
  const maintain = settings
    ? calorieTargetKcal(
        {
          weightKg,
          heightCm: settings.height_cm,
          birthYear: settings.birth_year,
          sex: settings.sex,
          activityLevel: settings.activity_level,
        },
        todayYear,
        "maintain",
      )
    : null;

  return (
    <section aria-label="Profilo" className="em-card p-5">
      <p className="em-eyebrow">Profilo</p>
      <p className="em-body-sm mt-2 text-[var(--em-text-3)]">
        Questi numeri servono solo alle stime (acqua, calorie): sono stime
        di formula, non prescrizioni.
      </p>

      {/* Skeleton invece del pop-in (run-10 P4, PROP-imp-01). */}
      {settings === undefined ? (
        <div className="mt-4 flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-2/3" />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="em-eyebrow">Altezza (cm)</span>
              <Input
                key={`h:${settings.height_cm ?? ""}`}
                defaultValue={settings.height_cm?.toString() ?? ""}
                inputMode="numeric"
                placeholder="180"
                maxLength={3}
                onBlur={(e) =>
                  void patch({
                    height_cm:
                      e.target.value.trim() === ""
                        ? null
                        : parseIntOrNull(e.target.value, 100, 250),
                  })
                }
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="em-eyebrow">Anno di nascita</span>
              <Input
                key={`b:${settings.birth_year ?? ""}`}
                defaultValue={settings.birth_year?.toString() ?? ""}
                inputMode="numeric"
                placeholder="1996"
                maxLength={4}
                onBlur={(e) =>
                  void patch({
                    birth_year:
                      e.target.value.trim() === ""
                        ? null
                        : parseIntOrNull(e.target.value, 1900, 2100),
                  })
                }
              />
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="em-eyebrow">Sesso (per le formule)</span>
            <div className="flex gap-1.5" role="group" aria-label="Sesso">
              {(
                [
                  { value: "m", label: "Uomo" },
                  { value: "f", label: "Donna" },
                ] as const
              ).map((opt) => (
                <ProfileChip
                  key={opt.value}
                  label={opt.label}
                  active={settings.sex === opt.value}
                  onClick={() =>
                    void patch({
                      sex: settings.sex === opt.value ? null : opt.value,
                    })
                  }
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="em-eyebrow">Attività</span>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Livello di attività"
            >
              {ACTIVITY_LABELS.map((label, i) => (
                <ProfileChip
                  key={label}
                  label={label}
                  active={settings.activity_level === i + 1}
                  onClick={() =>
                    void patch({
                      activity_level:
                        settings.activity_level === i + 1 ? null : i + 1,
                    })
                  }
                />
              ))}
            </div>
          </div>

          {water !== null || maintain !== null ? (
            <p className="em-body-sm text-[var(--em-text-3)]">
              Stime di oggi:
              {water !== null ? (
                <>
                  {" "}
                  acqua ~
                  <span className="em-num">
                    {(water / 1000).toLocaleString("it-IT", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}{" "}
                    l
                  </span>
                </>
              ) : null}
              {water !== null && maintain !== null ? " · " : null}
              {maintain !== null ? (
                <>
                  mantenimento ~
                  <span className="em-num">
                    {maintain.toLocaleString("it-IT")} kcal
                  </span>
                </>
              ) : null}
              {maintain === null ? (
                <> — per le calorie completa profilo e peso.</>
              ) : null}
            </p>
          ) : (
            <p className="em-body-sm text-[var(--em-text-3)]">
              Con peso (modulo Corpo) e profilo completi, qui compaiono le
              stime di acqua e calorie.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function ProfileChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "em-body-sm h-11 rounded-full px-3.5 font-medium transition-colors duration-[var(--em-dur-tap)]",
        active
          ? "bg-[var(--em-ember-tint)] text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)]"
          : "bg-[var(--em-surface-2)] text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] hover:text-[var(--em-text)]",
      )}
    >
      {label}
    </button>
  );
}
