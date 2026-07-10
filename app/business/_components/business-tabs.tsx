import Link from "next/link";
import { getRegisteredModules } from "@/lib/modules";

/**
 * BusinessTabs — sub-nav per le rotte /business/*.
 *
 * Le tab sono derivate dal module registry: filtra i moduli con
 * `businessTab: true`, ordinati per `tabOrder` ascendente. Overview
 * è sempre prima; gli altri arrivano dinamicamente dal registry,
 * quindi aggiungere/rimuovere un modulo non richiede modifiche
 * al call site.
 *
 * `active` è una stringa generic: `"overview"` per la home
 * `/business`, oppure il `id` del modulo attivo (es.
 * `"chameleon_os"`).
 */
export function BusinessTabs({ active }: { active: string }) {
  const moduleTabs = getRegisteredModules().filter((m) => m.businessTab);

  // Overview è sempre primo. Gli altri arrivano dal registry,
  // già ordinati per tabOrder asc (poi insertion order).
  const tabs: Array<{ href: string; label: string; id: string }> = [
    { href: "/business", label: "Overview", id: "overview" },
    ...moduleTabs.map((m) => ({ href: m.route, label: m.label, id: m.id })),
  ];

  return (
    <nav aria-label="Sub-tabs Business" className="overflow-x-auto">
      <ul className="flex gap-2">
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={isActive ? "page" : undefined}
                className={`block whitespace-nowrap rounded-full px-3 py-1.5 text-xs ${
                  isActive
                    ? "bg-text-primary text-bg"
                    : "border border-border bg-surface text-text-secondary hover:text-text-primary"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
