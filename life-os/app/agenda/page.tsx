import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/app/_components/bottom-nav";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { AgendaDayGroup } from "@/components/ui/agenda-day-group";
import { todayInTimezone } from "@/lib/tasks/generator";
import {
  filterFromDay,
  groupEventsByDay,
  mergeAgendaEvents,
  type ExternalAgendaEvent,
  type LocalAgendaEntry,
} from "@/lib/agenda/merge";
import { addEntry } from "@/app/custom/actions";
import { refreshGoogleCalendar, disconnectGoogleCalendar } from "./actions";

const AGENDA_MODULE_NAME = "Agenda principale";

function relativeTimeIt(iso: string | null, now = new Date()): string {
  if (!iso) return "mai";
  const d = new Date(iso);
  const diffMs = now.getTime() - d.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "adesso";
  if (min < 60) return `${min} min fa`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h fa`;
  const day = Math.floor(hr / 24);
  return `${day} g fa`;
}

export default async function AgendaPage(props: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const searchParams = await props.searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone, onboarding_completed")
    .eq("id", user.id)
    .single();
  if (!profile?.onboarding_completed) redirect("/onboarding");
  const timezone = profile.timezone ?? "Europe/Rome";
  const today = todayInTimezone(timezone);

  // Find or auto-create the local "Agenda principale" custom calendar
  // module. Kept separate from other user-created kind=calendar modules
  // so the form on this page has a stable target id.
  let agendaModule: { id: string; name: string } | null = null;
  {
    const { data: existing } = await supabase
      .from("custom_modules")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("kind", "calendar")
      .eq("name", AGENDA_MODULE_NAME)
      .maybeSingle();
    if (existing) {
      agendaModule = existing;
    } else {
      const { data: created, error: createErr } = await supabase
        .from("custom_modules")
        .insert({
          user_id: user.id,
          name: AGENDA_MODULE_NAME,
          kind: "calendar",
          config: {},
          include_in_daily_tasks: false,
        })
        .select("id, name")
        .single();
      if (createErr) {
        // Race fallback: another request may have created it concurrently.
        const { data: retried } = await supabase
          .from("custom_modules")
          .select("id, name")
          .eq("user_id", user.id)
          .eq("kind", "calendar")
          .eq("name", AGENDA_MODULE_NAME)
          .maybeSingle();
        agendaModule = retried;
      } else {
        agendaModule = created;
      }
    }
  }

  // Connected external account (V0: at most one Google account).
  const { data: account } = await supabase
    .from("external_calendar_accounts")
    .select("id, external_account_email, last_synced_at, last_sync_error")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .maybeSingle();

  // Local entries belonging ONLY to the agenda module (other kind=calendar
  // custom modules remain accessible via /custom/[id]).
  const { data: localEntriesRaw } = agendaModule
    ? await supabase
        .from("custom_module_entries")
        .select("id, custom_module_id, date, label, notes")
        .eq("user_id", user.id)
        .eq("custom_module_id", agendaModule.id)
        .order("date", { ascending: true })
    : { data: [] };
  const localEntries = (localEntriesRaw ?? []) as LocalAgendaEntry[];

  // External events for the connected account (full window — already
  // bounded at sync time to [-7d, +30d]).
  const { data: externalEventsRaw } = account
    ? await supabase
        .from("external_calendar_events")
        .select(
          "id, external_id, title, description, location, starts_at, ends_at, all_day, status, html_link",
        )
        .eq("user_id", user.id)
        .eq("account_id", account.id)
        .order("starts_at", { ascending: true })
    : { data: [] };
  const externalEvents = (externalEventsRaw ?? []) as ExternalAgendaEvent[];

  const allEvents = mergeAgendaEvents(localEntries, externalEvents);
  // Drop anything before today (events from past days are kept in the
  // sync window for fuzzier "what just happened" queries elsewhere,
  // but the agenda surface itself shows only forward-looking days).
  const events = filterFromDay(allEvents, today, timezone);
  const dayGroups = groupEventsByDay(events, timezone);

  // Status pill copy.
  let statusLabel: string;
  let statusVariant: "good" | "warn" | "bad" | "neutral";
  if (account) {
    if (account.last_sync_error) {
      statusLabel = `Errore sync · ${relativeTimeIt(account.last_synced_at)}`;
      statusVariant = "bad";
    } else if (account.last_synced_at) {
      statusLabel = `Google connesso · ${externalEvents.length} eventi · sync ${relativeTimeIt(account.last_synced_at)}`;
      statusVariant = "good";
    } else {
      statusLabel = "Google connesso · mai sincronizzato";
      statusVariant = "warn";
    }
  } else {
    statusLabel = "Non connesso";
    statusVariant = "neutral";
  }

  const callbackError = searchParams.error;
  const callbackConnected = searchParams.connected;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-6 pt-7">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">Layer agenda</p>
          <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
          <div className="mt-2">
            <StatusPill label={statusLabel} variant={statusVariant} />
          </div>
        </div>
        <Link
          href="/more"
          className="rounded-md border border-border px-3 py-2 text-sm text-text-secondary hover:text-text-primary"
        >
          Indietro
        </Link>
      </header>

      {callbackConnected ? (
        <div
          role="status"
          className="mt-4 rounded-md border border-accent-good/40 bg-accent-good/5 px-3 py-2 text-sm text-accent-good"
        >
          Account Google collegato. Premi &quot;Sincronizza&quot; per importare gli eventi.
        </div>
      ) : null}
      {callbackError ? (
        <div
          role="alert"
          className="mt-4 rounded-md border border-accent-bad/40 bg-accent-bad/5 px-3 py-2 text-sm text-accent-bad"
        >
          Connessione fallita: {callbackError}.
        </div>
      ) : null}

      {!account ? (
        <section className="mt-7 rounded-xl border border-border bg-surface p-5 text-center">
          <p className="text-sm text-text-secondary">
            Collega Google Calendar per vedere i tuoi eventi qui.
          </p>
          <Link
            href="/api/auth/google/start"
            className="mt-3 inline-flex items-center justify-center rounded-md bg-text-primary px-4 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
          >
            Connetti Google
          </Link>
        </section>
      ) : null}

      {agendaModule ? (
        <section className="mt-7 rounded-xl border border-border bg-surface p-5">
          <SectionHeader label="Aggiungi evento" />
          <form action={addEntry} className="mt-3 space-y-2">
            <input type="hidden" name="custom_module_id" value={agendaModule.id} />
            <input
              type="date"
              name="date"
              defaultValue={today}
              aria-label="Data evento"
              className="w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary focus:border-accent-info focus:outline-none"
            />
            <input
              type="text"
              name="label"
              maxLength={120}
              required
              aria-label="Titolo evento"
              placeholder="evento (es. cena con Marco)"
              className="w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none"
            />
            <input
              type="text"
              name="notes"
              maxLength={200}
              aria-label="Note evento"
              placeholder="note (opzionale)"
              className="w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none"
            />
            <button
              type="submit"
              className="w-full rounded-md bg-text-primary px-4 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
            >
              + aggiungi
            </button>
          </form>
        </section>
      ) : null}

      <section className="mt-7">
        <SectionHeader
          label="Prossimi giorni"
          meta={`${events.length} ${events.length === 1 ? "evento" : "eventi"}`}
        />
        {dayGroups.length > 0 ? (
          <div className="mt-3">
            {dayGroups.map((g) => (
              <AgendaDayGroup
                key={g.date}
                group={g}
                timezone={timezone}
                todayYmd={today}
              />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-text-muted">
            Nessun evento in agenda. Aggiungine uno o sincronizza Google.
          </p>
        )}
      </section>

      {account ? (
        <section className="mt-7 flex gap-2">
          <form action={refreshGoogleCalendar} className="flex-1">
            <button
              type="submit"
              className="w-full rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:border-text-muted"
            >
              Sincronizza Google
            </button>
          </form>
          <form action={disconnectGoogleCalendar}>
            <button
              type="submit"
              aria-label="Disconnetti Google"
              className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text-muted transition-colors hover:border-accent-bad/40 hover:text-accent-bad"
            >
              Disconnetti
            </button>
          </form>
        </section>
      ) : null}

      {account?.last_sync_error ? (
        <p className="mt-3 text-xs text-accent-bad">
          Ultimo errore sync: {account.last_sync_error.slice(0, 200)}
        </p>
      ) : null}

      <div className="h-16" aria-hidden="true" />
      <BottomNav active="Più" />
    </main>
  );
}
