"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { parseCommuteMode } from "@/lib/validation/local-storage";

// CommuteToggle — per-device manual override for the commute banner
// shown on the dashboard. Writes to localStorage under the same key
// the CommuteBanner reads ("lifeos.commute.manual"), so changes here
// take effect on the next dashboard render.
//
// Three states:
//   - "auto"  → no override, follow isCommuteActive() server detection
//   - "on"    → force the banner on regardless of detection
//   - "off"   → force the banner off regardless of detection
//
// The "auto" state corresponds to absence of the localStorage key.

const LS_KEY = "lifeos.commute.manual";
type Mode = "auto" | "on" | "off";

function readMode(): Mode {
  try {
    return parseCommuteMode(window.localStorage.getItem(LS_KEY)) ?? "auto";
  } catch {
    return "auto";
  }
}

function writeMode(mode: Mode) {
  try {
    if (mode === "auto") {
      window.localStorage.removeItem(LS_KEY);
    } else {
      window.localStorage.setItem(LS_KEY, mode);
    }
  } catch {
    // localStorage unavailable (incognito quota etc.) — fail silent.
  }
}

const OPTIONS: { value: Mode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "on", label: "Sempre ON" },
  { value: "off", label: "Sempre OFF" },
];

export function CommuteToggle() {
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<Mode>("auto");

  useEffect(() => {
    // TODO V2: refactor to useSyncExternalStore for cleaner localStorage
    // wiring. For V1 the setState-in-effect cost is negligible (single
    // render on mount, no cascade).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(readMode());
    setHydrated(true);
  }, []);

  function handleClick(next: Mode) {
    setMode(next);
    writeMode(next);
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-text-muted">
            Modalità commute
          </p>
          <p className="mt-1 text-sm text-text-primary">
            Banner dashboard nelle ore di pendolarismo
          </p>
        </div>
        <Link
          href="/commute"
          className="inline-flex min-h-[44px] shrink-0 items-center rounded-md border border-accent-energy/40 bg-accent-energy/5 px-3 text-xs font-medium text-accent-energy hover:border-accent-energy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          Apri →
        </Link>
      </div>

      <div
        role="radiogroup"
        aria-label="Modalità commute"
        className="mt-3 flex gap-2"
      >
        {OPTIONS.map((opt) => {
          const active = hydrated && mode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => handleClick(opt.value)}
              className={`inline-flex min-h-[44px] flex-1 items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
                active
                  ? "border-accent-energy bg-accent-energy/10 text-accent-energy"
                  : "border-border text-text-muted hover:border-text-muted hover:text-text-secondary"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[10px] text-text-muted">
        Auto = mostra il banner solo quando oggi è in presenza e l&apos;orario
        è 7:00–9:30 o 17:00–19:30. Override per-device, non sincronizzato.
      </p>
    </div>
  );
}
