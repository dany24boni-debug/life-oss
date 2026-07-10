"use client";

/**
 * Sezione Palestra di Oggi (B2.3, "Today wiring") — lo stato VERO della
 * giornata: niente sessione → CTA "Inizia allenamento"; in corso →
 * riprendi; conclusa → riga riepilogo con volume e durata.
 */

import Link from "next/link";
import { Skeleton } from "@/ui";
import { useGymSessionsByDay, useSetsBySession } from "@/data/hooks";
import type { GymSession } from "@/data/schemas";
import { formatKg, sessionDurationMin, totalVolumeKg } from "../gym/logic";
import { useToday } from "./tasks/screen-hooks";

export function TodayGym() {
  const today = useToday();
  const sessions = useGymSessionsByDay(today);

  const active = (sessions ?? []).find((s) => s.finished_at === null) ?? null;
  const done = (sessions ?? []).find((s) => s.finished_at !== null) ?? null;

  return (
    <section aria-label="Palestra" className="em-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="em-eyebrow">Palestra</p>
        <Link
          href="/gym"
          className="em-body-sm text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-control)] hover:text-[var(--em-text)]"
        >
          Modulo
        </Link>
      </div>

      {sessions === undefined ? (
        <div className="mt-3" aria-busy="true">
          <Skeleton className="h-10 w-2/3" />
        </div>
      ) : active ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="em-body text-[var(--em-text)]">
            Allenamento in corso
            <span className="em-dot em-dot--live ml-2" aria-hidden="true" />
          </p>
          <GymCta href="/gym" label="Riprendi" />
        </div>
      ) : done ? (
        <DoneLine session={done} />
      ) : (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="em-body-sm text-[var(--em-text-3)]">
            Nessun allenamento oggi, per ora.
          </p>
          <GymCta href="/gym" label="Inizia allenamento" />
        </div>
      )}
    </section>
  );
}

function DoneLine({ session }: { session: GymSession }) {
  const sets = useSetsBySession(session.id);
  const duration = sessionDurationMin(session.started_at, session.finished_at);
  return (
    <p className="em-body mt-3 text-[var(--em-text-2)]">
      Fatto per oggi
      {sets !== undefined && sets.length > 0 ? (
        <>
          {" "}
          · <span className="em-num">{formatKg(totalVolumeKg(sets))}</span> di
          volume
        </>
      ) : null}
      {duration !== null ? (
        <>
          {" "}
          · <span className="em-num">{duration} min</span>
        </>
      ) : null}
    </p>
  );
}

function GymCta({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-[var(--em-control-h-md)] shrink-0 items-center justify-center rounded-[var(--em-r-md)] bg-[var(--em-ember)] px-4 text-[length:var(--em-fs-body)] font-semibold text-[var(--em-on-ember)] transition-[background] duration-[var(--em-dur-control)] hover:bg-[color-mix(in_srgb,var(--em-ember)_88%,var(--em-text))]"
    >
      {label}
    </Link>
  );
}
