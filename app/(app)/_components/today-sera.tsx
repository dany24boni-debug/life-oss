"use client";

/**
 * L'aggancio serale su Oggi (run-11 P4, PROP-sera-01): dopo le 20, se
 * il check-in di stasera non esiste ancora, una card quieta invita a
 * chiudere la giornata — e sparisce da sola a check-in iniziato.
 * Deterministica: l'ora viene dall'orologio condiviso della home, il
 * gate sul dato rende null in SSR e in caricamento (mai flicker).
 */

import Link from "next/link";
import { useCheckin } from "@/data/hooks";
import { IconChevronRight } from "./icons";
import { useToday } from "./tasks/screen-hooks";
import { useNowHhmm } from "./today-adesso";

const EVENING_FROM = "20:00";

export function TodaySera() {
  const today = useToday();
  const checkin = useCheckin(today);
  const nowHhmm = useNowHhmm();

  // Quieta per costruzione: solo la sera, solo finché non c'è nulla.
  if (nowHhmm < EVENING_FROM) return null;
  if (checkin === undefined || checkin !== null) return null;

  return (
    <section aria-label="Sera" className="em-card p-5">
      <Link
        href="/sera"
        className="group flex items-center justify-between gap-3"
      >
        <div className="min-w-0">
          <p className="em-eyebrow">Sera</p>
          <p className="em-body mt-1 text-[var(--em-text)]">
            Com&apos;è andata la giornata?
          </p>
        </div>
        <IconChevronRight className="shrink-0 text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-control)] group-hover:text-[var(--em-text)]" />
      </Link>
    </section>
  );
}
