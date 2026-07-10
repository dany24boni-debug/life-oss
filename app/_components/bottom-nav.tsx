// BottomNav — Pulse 5-tab nav (handoff §B / 01-components §6).
//
// Tabs: Main / Body / Finance / Business|Custom / Più
//
//   - Main   → /dashboard
//   - Body   → /body  (landing with Gym + Health cards)
//   - Finance → /finance
//   - Business → /business  (only if user has any private whitelist)
//     OR
//   - Custom → /custom      (fallback for non-whitelisted)
//   - Più    → /more
//
// Pulse visual:
//   - No icons. Active = 4×4 energy dot above the mono label with a soft
//     glow; inactive = transparent placeholder dot (keeps row vertical
//     rhythm stable between active/inactive).
//   - Labels: mono uppercase 10px, tracking 0.12em.
//   - Top hairline + bg/95 backdrop, sticky bottom, safe-area inset.
//   - Min tap target 48px.
//
// Note on `active`: pages pass a string label. If a page passes a label that
// the current user can't see (e.g. owner on /custom — Custom tab hidden),
// no tab highlights — acceptable edge case.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPrivateWhitelist, hasAnyPrivate } from "@/lib/auth/whitelist";

type Tab = {
  href: string;
  label: BottomNavLabel;
  /** Owner-only tab — needs whitelist to be visible. */
  owner?: boolean;
  /** Fallback tab — visible only when owner=false (i.e. NOT whitelisted). */
  fallback?: boolean;
};

const ALL_TABS: readonly Tab[] = [
  { href: "/dashboard", label: "Main" },
  { href: "/body", label: "Body" },
  { href: "/finance", label: "Finance" },
  { href: "/business", label: "Business", owner: true },
  { href: "/custom", label: "Custom", fallback: true },
  { href: "/more", label: "Più" },
] as const;

export type BottomNavLabel =
  | "Main"
  | "Body"
  | "Finance"
  | "Business"
  | "Custom"
  | "Più";

export async function BottomNav({ active }: { active: BottomNavLabel }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let showBusiness = false;
  if (user) {
    const whitelist = await getPrivateWhitelist(supabase, user.id);
    showBusiness = hasAnyPrivate(whitelist);
  }
  // Whitelisted user sees Business; everyone else sees Custom in that slot.
  const tabs = ALL_TABS.filter((t) => {
    if (t.owner) return showBusiness;
    if (t.fallback) return !showBusiness;
    return true;
  });

  return (
    <nav
      aria-label="Navigazione principale"
      className="sticky bottom-0 z-10 -mx-5 mt-auto border-t border-border bg-bg/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="flex items-stretch justify-between">
        {tabs.map(({ href, label }) => {
          const isActive = label === active;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 px-1 py-2 transition-colors ${
                  isActive
                    ? "text-text-primary"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-1 w-1 rounded-full"
                  style={
                    isActive
                      ? {
                          background: "var(--color-accent-energy)",
                          boxShadow: "0 0 6px var(--color-accent-energy)",
                        }
                      : { background: "transparent" }
                  }
                />
                <span
                  className="font-semibold uppercase"
                  style={{
                    fontSize: 10,
                    letterSpacing: "var(--tracking-mono-md, 0.12em)",
                  }}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
