"use client";

/**
 * Il dot di sync della shell (B4: l'ember dot segna anche "sync-in-flight").
 * Slot sempre presente accanto al wordmark; il dot respira SOLO mentre un
 * ciclo è in corso. Errori e ultimo sync vivono in Impostazioni, non qui —
 * la shell resta quieta.
 */

import { useSyncStatus } from "@/data/hooks";

export function SyncDot() {
  const sync = useSyncStatus();
  const busy = sync.enabled && sync.status === "syncing";
  return (
    <span
      aria-hidden="true"
      data-sync-dot
      className="inline-flex h-2 w-2 items-center justify-center"
    >
      {busy ? <span className="em-dot em-dot--live" /> : null}
    </span>
  );
}
