import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// /commute — schermata semplificata pensata per uso in treno/in piedi:
// niente bottom nav, niente form, 3 card grandi tap-friendly che
// rimandano alle attività brevi-da-fare-in-commute.
//
// V1 le card sono placeholder (href="#") — il riassunto capitolo +
// flashcards + note arrivano negli sprint successivi.

type CardSpec = {
  title: string;
  desc: string;
  emoji: string;
  href: string;
};

const COMMUTE_CARDS: CardSpec[] = [
  {
    emoji: "🎧",
    title: "Ascolta riassunto capitolo",
    desc: "Audio breve del capitolo in studio (in arrivo).",
    href: "#",
  },
  {
    emoji: "🃏",
    title: "Ripassa flashcards",
    desc: "5-10 carte dalla materia più urgente (in arrivo).",
    href: "#",
  },
  {
    emoji: "📝",
    title: "Leggi note brevi",
    desc: "I tuoi appunti rapidi sulla materia di oggi (in arrivo).",
    href: "#",
  },
];

export default async function CommutePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .single();
  if (!profile?.onboarding_completed) redirect("/onboarding");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-6 pt-7">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">Modalità</p>
          <h1 className="text-2xl font-semibold tracking-tight text-accent-energy">
            Commute
          </h1>
          <p className="mt-2 text-xs text-text-muted">
            Tre cose veloci da fare ora. Niente di lungo.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-md border border-border px-3 py-2 text-sm text-text-secondary hover:text-text-primary"
        >
          Esci
        </Link>
      </header>

      <section className="mt-7 space-y-3">
        {COMMUTE_CARDS.map((c) => {
          const disabled = c.href === "#";
          // V1: placeholder cards (audio/flashcards/notes are future
          // sprint targets). A disabled <Link> with aria-disabled is
          // still keyboard-focusable and Enter would navigate to "#"
          // (scroll-to-top). Render as <div role="group"> when no
          // real href — non-interactive semantics.
          if (disabled) {
            return (
              <div
                key={c.title}
                role="group"
                aria-label={`${c.title} — in arrivo`}
                className="block rounded-xl border border-border bg-surface p-6 opacity-70"
              >
                <div className="flex items-start gap-4">
                  <span aria-hidden="true" className="text-3xl">
                    {c.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-text-primary">
                      {c.title}
                    </h2>
                    <p className="mt-1 text-xs text-text-secondary">{c.desc}</p>
                  </div>
                </div>
              </div>
            );
          }
          return (
            <Link
              key={c.title}
              href={c.href}
              className="block rounded-xl border border-border bg-surface p-6 transition-colors hover:border-text-muted"
            >
              <div className="flex items-start gap-4">
                <span aria-hidden="true" className="text-3xl">
                  {c.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-text-primary">
                    {c.title}
                  </h2>
                  <p className="mt-1 text-xs text-text-secondary">{c.desc}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      <div className="mt-auto pt-8 text-center">
        <p className="text-[10px] uppercase tracking-wider text-text-muted">
          Modalità commute · niente nav
        </p>
      </div>
    </main>
  );
}
