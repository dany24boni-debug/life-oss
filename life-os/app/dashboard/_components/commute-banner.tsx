"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { parseCommuteMode } from "@/lib/validation/local-storage";

// CommuteBanner — shown on the dashboard when the user is in commute
// mode. Server detection is passed via `autoActive`; the client then
// reads a per-device localStorage override ("on" / "off" / null) and
// computes the final visibility.
//
// Decision table:
//   manual = "on"           → banner shown (force ON, regardless of auto)
//   manual = "off"          → banner hidden (force OFF, regardless of auto)
//   manual = null + auto    → banner shown (auto detection)
//   manual = null + !auto   → banner hidden
//
// localStorage key: "lifeos.commute.manual" — written by the /more
// CommuteToggle component on the same device. Not synced across devices
// (intentional: commute is a per-device, time-of-day concept).

const LS_KEY = "lifeos.commute.manual";

type Props = {
  /** Server-computed: true when isCommuteActive(events, tz, now) === true today. */
  autoActive: boolean;
};

export function CommuteBanner({ autoActive }: Props) {
  // We start hidden on the server render to avoid hydration mismatch
  // when localStorage differs from server detection. The first client
  // effect resolves the real visibility.
  const [hydrated, setHydrated] = useState(false);
  const [manual, setManual] = useState<"on" | "off" | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(LS_KEY);
    } catch {
      stored = null;
    }
    // TODO V2: refactor to useSyncExternalStore for cleaner localStorage
    // wiring + cross-tab updates. For V1 the setState-in-effect cost is
    // negligible (single render on mount, no cascade).
    const mode = parseCommuteMode(stored);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setManual(mode);
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  const show = manual === "on" || (autoActive && manual !== "off");
  if (!show) return null;

  const reason = manual === "on" ? "manuale" : "auto";

  return (
    <section className="mx-auto mt-4 max-w-md px-5">
      <Link
        href="/commute"
        className="group block rounded-xl border border-accent-energy/40 bg-accent-energy/5 p-4 transition-colors hover:border-accent-energy"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-accent-energy">
              Modalità commute attiva · {reason}
            </p>
            <p className="mt-0.5 text-sm text-text-primary">
              Apri schermata commute →
            </p>
          </div>
          <span
            aria-hidden="true"
            className="text-accent-energy transition-colors group-hover:opacity-90"
          >
            ›
          </span>
        </div>
      </Link>
    </section>
  );
}
