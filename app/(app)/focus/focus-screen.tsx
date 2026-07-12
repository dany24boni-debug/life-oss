"use client";

/**
 * Lo schermo di /focus — il pomodoro:
 *   1. L'anello grande col tempo che manca, la fase e il giro cicli.
 *   2. Controlli: Avvia/Pausa, ±1 minuto in corsa, Salta, Ricomincia.
 *   3. Durate: steppers per lavoro/pausa/pausa lunga/cicli + preset.
 *   4. Oggi: i minuti di focus già fatti (registro vero, sincronizzato).
 */

import { Button, ProgressRing, Skeleton, cx } from "@/ui";
import { useFocusMinutesByDay } from "@/data/hooks";
import {
  FOCUS_PRESETS,
  clampConfig,
  formatRemaining,
  phaseLabel,
  remainingMs,
  type FocusConfig,
  type FocusState,
} from "@/lib/focus/engine";
import { useToday } from "../_components/tasks/screen-hooks";
import { useFocusTimer } from "./use-focus";

export function FocusScreen() {
  const { state, nowMs, actions } = useFocusTimer();

  if (state === null) {
    return (
      <div aria-busy="true" className="flex flex-col items-center gap-4">
        <Skeleton className="h-56 w-56 rounded-full" />
        <Skeleton className="h-11 w-40" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <TimerCard state={state} nowMs={nowMs} actions={actions} />
      <ConfigCard state={state} onConfig={actions.setConfig} />
      <TodayFocusCard />
    </div>
  );
}

/* ── Timer ───────────────────────────────────────────────────────────── */

function TimerCard({
  state,
  nowMs,
  actions,
}: {
  state: FocusState;
  nowMs: number;
  actions: ReturnType<typeof useFocusTimer>["actions"];
}) {
  const remaining = remainingMs(state, nowMs);
  const progress =
    state.duration_ms > 0
      ? ((state.duration_ms - remaining) / state.duration_ms) * 100
      : 0;
  const isWork = state.phase === "work";

  return (
    <section
      aria-label="Timer"
      className="em-card flex flex-col items-center gap-5 p-6"
    >
      <p className="em-eyebrow">
        {phaseLabel(state.phase)}
        {isWork ? (
          <span className="em-num ml-2 text-[var(--em-text-3)]">
            ciclo {state.cycle}/{state.config.cycles}
          </span>
        ) : null}
      </p>

      <ProgressRing
        value={progress}
        size={216}
        strokeWidth={10}
        tone={isWork ? "ember" : "salvia"}
        label={`${phaseLabel(state.phase)}: mancano ${formatRemaining(remaining)}`}
      >
        <span className="flex flex-col items-center gap-1">
          <span className="em-num text-5xl font-semibold tabular-nums text-[var(--em-text)]">
            {formatRemaining(remaining)}
          </span>
          {state.running ? (
            <span className="em-dot em-dot--live" aria-hidden="true" />
          ) : (
            <span className="em-body-sm text-[var(--em-text-3)]">
              {state.elapsed_ms > 0 ? "in pausa" : "pronto"}
            </span>
          )}
        </span>
      </ProgressRing>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={actions.startPause}
        >
          {state.running ? "Pausa" : state.elapsed_ms > 0 ? "Riprendi" : "Avvia"}
        </Button>
        <Button type="button" variant="ghost" onClick={actions.skip}>
          Salta
        </Button>
        <Button type="button" variant="ghost" onClick={actions.resetAll}>
          Ricomincia
        </Button>
      </div>

      <div className="flex items-center gap-2" role="group" aria-label="Aggiusta il tempo">
        <MinuteBtn label="Meno un minuto" onClick={() => actions.adjust(-1)}>
          −1&apos;
        </MinuteBtn>
        <span className="em-body-sm text-[var(--em-text-3)]">
          aggiusta in corsa
        </span>
        <MinuteBtn label="Più un minuto" onClick={() => actions.adjust(1)}>
          +1&apos;
        </MinuteBtn>
      </div>
    </section>
  );
}

function MinuteBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="em-body-sm em-num grid h-11 min-w-14 place-items-center rounded-[var(--em-r-sm)] bg-[var(--em-surface-2)] px-3 font-semibold text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] active:bg-[var(--em-ember-tint)] active:text-[var(--em-text)]"
    >
      {children}
    </button>
  );
}

/* ── Durate e preset ─────────────────────────────────────────────────── */

const CONFIG_FIELDS: Array<{
  key: keyof FocusConfig;
  label: string;
  unit: string;
}> = [
  { key: "work_min", label: "Lavoro", unit: "min" },
  { key: "break_min", label: "Pausa", unit: "min" },
  { key: "long_break_min", label: "Pausa lunga", unit: "min" },
  { key: "cycles", label: "Cicli", unit: "" },
];

function ConfigCard({
  state,
  onConfig,
}: {
  state: FocusState;
  onConfig: (config: FocusConfig) => void;
}) {
  const config = state.config;

  function step(key: keyof FocusConfig, delta: number) {
    onConfig(clampConfig({ ...config, [key]: config[key] + delta }));
  }

  return (
    <section aria-label="Durate" className="em-card p-5">
      <p className="em-eyebrow">Durate</p>
      <p className="em-body-sm mt-1 text-[var(--em-text-3)]">
        Le modifiche valgono dalla prossima fase; quella in corsa non salta.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CONFIG_FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col items-start gap-1.5">
            <span className="em-eyebrow">{f.label}</span>
            <div className="flex items-center gap-1">
              <StepBtn label={`Meno ${f.label}`} onClick={() => step(f.key, -1)}>
                −
              </StepBtn>
              <span className="em-body em-num w-10 text-center font-semibold text-[var(--em-text)]">
                {config[f.key]}
              </span>
              <StepBtn label={`Più ${f.label}`} onClick={() => step(f.key, 1)}>
                +
              </StepBtn>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Preset">
        {FOCUS_PRESETS.map((preset) => {
          const active =
            JSON.stringify(preset.config) === JSON.stringify(config);
          return (
            <button
              key={preset.name}
              type="button"
              aria-pressed={active}
              onClick={() => onConfig(preset.config)}
              className={cx(
                "em-body-sm h-9 rounded-full px-3 font-medium transition-colors duration-[var(--em-dur-tap)]",
                active
                  ? "bg-[var(--em-ember-tint)] text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)]"
                  : "bg-[var(--em-surface-2)] text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] hover:text-[var(--em-text)]",
              )}
            >
              {preset.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function StepBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--em-r-sm)] bg-[var(--em-surface-2)] text-lg font-semibold text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] active:bg-[var(--em-ember-tint)] active:text-[var(--em-text)]"
    >
      {children}
    </button>
  );
}

/* ── Oggi: minuti fatti (registro vero) ──────────────────────────────── */

function TodayFocusCard() {
  const today = useToday();
  const minutes = useFocusMinutesByDay(today, today);

  return (
    <section aria-label="Focus di oggi" className="em-card p-5">
      <p className="em-eyebrow">Oggi</p>
      {minutes === undefined ? (
        <div aria-busy="true" className="mt-2">
          <Skeleton className="h-6 w-32" />
        </div>
      ) : (
        <p className="em-body mt-2 text-[var(--em-text)]">
          {minutes.length === 0 ? (
            <span className="text-[var(--em-text-3)]">
              Ancora niente: il primo pomodoro inaugura il conteggio.
            </span>
          ) : (
            <>
              <span className="em-num font-semibold">
                {minutes[0].minutes}
              </span>{" "}
              minuti di focus — contano nella streak.
            </>
          )}
        </p>
      )}
    </section>
  );
}
