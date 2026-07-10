"use client";

/**
 * Navigazione della shell (B3.5): tab bar in basso su mobile (5 slot,
 * safe-area), rail a sinistra da md in su (la cura del deserto desktop).
 * Tab attiva marcata dall'ember dot — l'unico elemento che respira.
 *
 * Nota collisioni rotte: da run-04 (prompt 10) la voce Palestra punta al
 * modulo NUOVO dentro la shell — la pagina legacy è stata rimossa dopo il
 * grep di supersessione (nessun import esterno). Impostazioni punta alla
 * superficie NUOVA /impostazioni (run-03): la legacy /settings resta
 * raggiungibile e protetta al suo indirizzo.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/ui";
import {
  IconCalendar,
  IconExam,
  IconGym,
  IconMoon,
  IconSettings,
  IconStats,
  IconTasks,
  IconToday,
  IconWallet,
} from "./icons";
import { SyncDot } from "./sync-dot";

type NavItem = {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactElement;
};

const TABS: NavItem[] = [
  { href: "/", label: "Oggi", icon: IconToday },
  { href: "/tasks", label: "Task", icon: IconTasks },
  { href: "/calendar", label: "Calendario", icon: IconCalendar },
  { href: "/gym", label: "Palestra", icon: IconGym },
  { href: "/stats", label: "Statistiche", icon: IconStats },
];

/**
 * Moduli oltre le 5 tab (run-05, stub 15): sul Rail desktop hanno la loro
 * sezione; su mobile vivono nella lista "Moduli" di Impostazioni — le tab
 * restano cinque.
 */
const MODULES: NavItem[] = [
  { href: "/esami", label: "Esami", icon: IconExam },
  { href: "/spese", label: "Spese", icon: IconWallet },
  { href: "/sera", label: "Sera", icon: IconMoon },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Tab bar mobile: fissa in basso, target >= 44px, etichette al floor 12px. */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--em-hairline)] bg-[var(--em-surface)] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex">
        {TABS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex h-16 flex-col items-center justify-center gap-1",
                  "transition-colors duration-[var(--em-dur-control)]",
                  active
                    ? "text-[var(--em-text)]"
                    : "text-[var(--em-text-3)] active:text-[var(--em-text-2)]",
                )}
              >
                <span className="flex h-1.5 items-center" aria-hidden="true">
                  {active ? <span className="em-dot em-dot--live" /> : null}
                </span>
                <item.icon />
                <span className="text-[length:var(--em-fs-label)] leading-[var(--em-lh-label)] font-medium">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Rail desktop (md+): nav verticale, Impostazioni ancorata in fondo. */
export function Rail() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-[var(--em-hairline)] bg-[var(--em-surface)] md:flex">
      <div className="flex items-center gap-2 px-5 pb-2 pt-6">
        <span className="em-eyebrow">LifeOS</span>
        {/* Dot di sync (prompt 08): respira solo durante un ciclo. */}
        <SyncDot />
      </div>
      <nav aria-label="Principale" className="flex flex-1 flex-col px-3">
        <ul className="flex flex-col gap-1">
          {TABS.map((item) => (
            <li key={item.href}>
              <RailLink item={item} active={isActive(pathname, item.href)} />
            </li>
          ))}
        </ul>
        <p className="em-eyebrow px-3 pb-1 pt-5">Moduli</p>
        <ul className="flex flex-col gap-1">
          {MODULES.map((item) => (
            <li key={item.href}>
              <RailLink item={item} active={isActive(pathname, item.href)} />
            </li>
          ))}
        </ul>
        <div className="mt-auto pb-5">
          <RailLink
            item={{
              href: "/impostazioni",
              label: "Impostazioni",
              icon: IconSettings,
            }}
            active={isActive(pathname, "/impostazioni")}
          />
        </div>
      </nav>
    </aside>
  );
}

function RailLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex h-11 items-center gap-3 rounded-[var(--em-r-md)] px-3",
        "transition-colors duration-[var(--em-dur-control)]",
        active
          ? "bg-[var(--em-ember-tint)] text-[var(--em-text)]"
          : "text-[var(--em-text-2)] hover:bg-[color-mix(in_srgb,var(--em-text)_7%,transparent)] hover:text-[var(--em-text)]",
      )}
    >
      <item.icon />
      <span className="em-body-sm font-medium">{item.label}</span>
      {active ? (
        <span className="em-dot em-dot--live ml-auto" aria-hidden="true" />
      ) : null}
    </Link>
  );
}

/** Header mobile: wordmark + accesso a Impostazioni (target 44px). */
export function MobileHeader() {
  return (
    <header className="flex items-center justify-between px-5 pt-[env(safe-area-inset-top)] md:hidden">
      <span className="flex items-center gap-2 py-4">
        <span className="em-eyebrow">LifeOS</span>
        {/* Dot di sync (prompt 08): respira solo durante un ciclo. */}
        <SyncDot />
      </span>
      <Link
        href="/impostazioni"
        aria-label="Impostazioni"
        className="grid h-11 w-11 place-items-center rounded-[var(--em-r-md)] text-[var(--em-text-2)] transition-colors duration-[var(--em-dur-control)] hover:text-[var(--em-text)]"
      >
        <IconSettings />
      </Link>
    </header>
  );
}
