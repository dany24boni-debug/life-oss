import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/app/_components/bottom-nav";
import { getPrivateWhitelist, hasAnyPrivate } from "@/lib/auth/whitelist";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { Avatar } from "@/components/ui/avatar";
import { signOut } from "@/lib/auth/actions";

type LinkRow = {
  href: string;
  label: string;
  desc: string;
  emoji?: string;
};

export default async function MorePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, is_owner, onboarding_completed")
    .eq("id", user.id)
    .single();
  if (!profile?.onboarding_completed) redirect("/onboarding");

  const whitelist = await getPrivateWhitelist(supabase, user.id);
  const showBusiness = hasAnyPrivate(whitelist);

  const dailyLinks: LinkRow[] = [
    { href: "/agenda", label: "Agenda", desc: "Eventi locali + Google Calendar", emoji: "📅" },
    { href: "/sera", label: "Sera", desc: "Recap del giorno + check-in energia/mood + carry-over", emoji: "🌙" },
    { href: "/esami", label: "Esami", desc: "Countdown + pacing per ogni esame", emoji: "🎓" },
    { href: "/recap", label: "Recap di oggi", desc: "% completamento, kept day, dettaglio task", emoji: "📊" },
    { href: "/timeline", label: "Timeline", desc: "Memoria: ogni evento di ogni modulo", emoji: "📜" },
    { href: "/insights", label: "Insights", desc: "Pattern auto-rilevati dai tuoi dati", emoji: "💡" },
    { href: "/settings", label: "Impostazioni", desc: "Stato e onboarding", emoji: "⚙️" },
  ];

  const dataLinks: LinkRow[] = [
    { href: "/settings/goals", label: "Long-term goals", desc: "I tuoi 24 mesi (Why Panel)", emoji: "🎯" },
    { href: "/settings/targets", label: "Monthly targets", desc: "Targets numerici del mese", emoji: "📈" },
    { href: "/onboarding?step=4", label: "Modifica moduli attivi", desc: "Quali moduli compaiono ovunque", emoji: "🧩" },
    { href: "/custom", label: "Moduli custom", desc: "Counter, streak, numeric, calendar", emoji: "✨" },
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-6 pt-7">
      <header className="flex items-center gap-3">
        <Avatar name={profile.display_name ?? user.email ?? "?"} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold leading-tight text-text-primary">
            {profile.display_name ?? user.email}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs leading-tight text-text-muted">
            {profile.is_owner ? <StatusPill label="Owner" variant="good" /> : null}
            {showBusiness ? <StatusPill label="Business" variant="live" /> : null}
            {!profile.is_owner && !showBusiness ? (
              <StatusPill label="Standard" variant="neutral" />
            ) : null}
          </p>
        </div>
      </header>

      {showBusiness ? (
        <section className="mt-7">
          <SectionHeader label="Layer privato" meta="whitelisted" />
          <div className="mt-2">
            <NavRow
              href="/business"
              label="Business"
              desc="Whitelisted private modules"
              emoji="💼"
              accent
            />
          </div>
        </section>
      ) : null}

      <section className="mt-7">
        <SectionHeader label="Daily" />
        <ul className="mt-2 space-y-2">
          {dailyLinks.map((row) => (
            <li key={row.href}>
              <NavRow {...row} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-7">
        <SectionHeader label="Dati e moduli" />
        <ul className="mt-2 space-y-2">
          {dataLinks.map((row) => (
            <li key={row.href}>
              <NavRow {...row} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 border-t border-border pt-5">
        <form action={signOut}>
          <button
            type="submit"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-secondary transition-colors hover:border-accent-bad/40 hover:text-accent-bad"
          >
            Esci
          </button>
        </form>
      </section>

      <div className="h-16" aria-hidden="true" />
      <BottomNav active="Più" />
    </main>
  );
}

function NavRow({
  href,
  label,
  desc,
  emoji,
  accent = false,
}: LinkRow & { accent?: boolean }) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
        accent
          ? "border-accent-info/40 bg-accent-info/5 hover:border-accent-info"
          : "border-border bg-surface hover:border-text-muted"
      }`}
    >
      {emoji ? (
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-base"
        >
          {emoji}
        </span>
      ) : null}
      <span className="flex-1 min-w-0">
        <span className="block truncate text-sm font-medium text-text-primary">{label}</span>
        <span className="block truncate text-xs text-text-muted">{desc}</span>
      </span>
      <span
        aria-hidden="true"
        className="text-text-muted transition-transform group-hover:translate-x-0.5"
      >
        ›
      </span>
    </Link>
  );
}
