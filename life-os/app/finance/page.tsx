import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/app/_components/bottom-nav";
import { todayInTimezone } from "@/lib/tasks/generator";
import { HeroRing } from "@/components/ui/hero-ring";
import { StatGrid } from "@/components/ui/stat-grid";
import { StatCard } from "@/components/ui/stat-card";
import { SegmentedBar } from "@/components/ui/segmented-bar";
import { SectionHeader } from "@/components/ui/section-header";
import { RoutineRow } from "@/components/ui/routine-row";
import { DateToggle } from "@/components/ui/date-toggle";
import { CATEGORIES, type Category } from "@/lib/finance/auto-classify";
import { logEntry, deleteEntry } from "./actions";
import { updateExpense, deleteExpense, addExpense } from "./expense-actions";
import { ExpenseForm } from "./_components/expense-form";

// /finance — Sprint U2 redesign.
//
// Tab nav: "Entrate" (default) | "Uscite".
//   - searchParams.tab = "entries" (default) | "expenses"
//   - searchParams.edit = uuid (forza tab Uscite se valido)
//
// Tab Entrate: UI legacy invariata. HeroRing savings rate +
// StatGrid + SegmentedBar + form income/expense unificato +
// lista finance_entries. Tutto basato su `finance_entries`.
//
// Tab Uscite (nuovo): stat strip (totale mese + count) +
// breakdown per categoria (barre orizzontali) + ExpenseForm
// (client, auto-classify) + lista personal_expenses recenti
// con ✏️ edit retroattivo.
//
// finance_entries.kind='expense' legacy NON viene mostrato nel
// tab Uscite (consistent col pattern Sprint U1 gym_workouts:
// la tabella vecchia sopravvive per safety storico ma la UI
// nuova non la mostra).

type Tab = "entries" | "expenses";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ExpenseRow = {
  id: string;
  expense_date: string;
  amount: string | number;
  category: Category;
  note: string | null;
};

type LegacyEntryRow = {
  id: string;
  date: string;
  kind: "income" | "expense" | string;
  amount_eur: string | number;
  category: string | null;
  description: string | null;
};

type LegacyMonthRow = {
  kind: "income" | "expense" | string;
  amount_eur: string | number;
  date: string;
};

function formatEur(n: number): string {
  return n.toLocaleString("it-IT", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

function formatDateIt(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export default async function FinancePage(props: {
  searchParams: Promise<{ tab?: string; edit?: string }>;
}) {
  const searchParams = await props.searchParams;
  const editIdRaw =
    typeof searchParams.edit === "string" ? searchParams.edit : null;
  const editId = editIdRaw && UUID_RE.test(editIdRaw) ? editIdRaw : null;

  // Tab routing: edit param forza tab Uscite (where edit lives).
  let tab: Tab =
    searchParams.tab === "expenses" ? "expenses" : "entries";
  if (editId) tab = "expenses";

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
  const monthStart = `${today.slice(0, 7)}-01`;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-6 pt-7">
      <header>
        <p className="text-sm text-text-secondary">Modulo</p>
        <h1 className="text-2xl font-semibold tracking-tight">Finance</h1>
      </header>

      {/* Tab nav */}
      <nav
        className="mt-5 flex gap-2 border-b border-border"
        aria-label="Sezioni finance"
      >
        <FinanceTabLink active={tab === "entries"} href="/finance?tab=entries">
          Entrate
        </FinanceTabLink>
        <FinanceTabLink active={tab === "expenses"} href="/finance?tab=expenses">
          Uscite
        </FinanceTabLink>
      </nav>

      {tab === "entries" ? (
        <EntriesTab
          supabaseUserId={user.id}
          today={today}
          monthStart={monthStart}
        />
      ) : (
        <ExpensesTab
          supabaseUserId={user.id}
          today={today}
          monthStart={monthStart}
          editId={editId}
        />
      )}

      <div className="h-16" aria-hidden="true" />
      <BottomNav active="Finance" />
    </main>
  );
}

function FinanceTabLink({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-[44px] items-center border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
        active
          ? "border-accent-energy text-text-primary"
          : "border-transparent text-text-muted hover:text-text-secondary"
      }`}
    >
      {children}
    </Link>
  );
}

// ============================================================
// Entrate tab — LEGACY (finance_entries)
// ============================================================

async function EntriesTab({
  supabaseUserId,
  today,
  monthStart,
}: {
  supabaseUserId: string;
  today: string;
  monthStart: string;
}) {
  const supabase = await createClient();
  const [{ data: monthEntries }, { data: recent }] = await Promise.all([
    supabase
      .from("finance_entries")
      .select("kind, amount_eur, date")
      .eq("user_id", supabaseUserId)
      .gte("date", monthStart)
      .order("date", { ascending: true }),
    supabase
      .from("finance_entries")
      .select("id, date, kind, amount_eur, category, description")
      .eq("user_id", supabaseUserId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  let income = 0;
  let expense = 0;
  for (const e of (monthEntries ?? []) as LegacyMonthRow[]) {
    const v = Number(e.amount_eur);
    if (e.kind === "income") income += v;
    else expense += v;
  }
  const net = income - expense;
  const savingsRate = income > 0 ? Math.max(0, (net / income) * 100) : 0;

  const todayDay = Number(today.slice(8, 10));
  const dailyNet = new Array(todayDay).fill(0) as number[];
  for (const e of (monthEntries ?? []) as LegacyMonthRow[]) {
    const day = Number(e.date.slice(8, 10));
    if (Number.isFinite(day) && day >= 1 && day <= todayDay) {
      const v = Number(e.amount_eur);
      dailyNet[day - 1] += e.kind === "income" ? v : -v;
    }
  }
  const runningNet: number[] = [];
  let acc = 0;
  for (const d of dailyNet) {
    acc += d;
    runningNet.push(acc);
  }
  const cardTrend =
    runningNet.length >= 2 && runningNet.some((v) => v !== 0)
      ? runningNet
      : undefined;

  const ringTone =
    savingsRate >= 30
      ? "good"
      : savingsRate >= 10
        ? "warn"
        : income === 0
          ? "info"
          : "bad";
  const ringSubtitle =
    income === 0
      ? "Nessuna entrata registrata"
      : net >= 0
        ? `+${formatEur(net)} € netto`
        : `${formatEur(net)} € netto`;

  const recentList = (recent ?? []) as LegacyEntryRow[];

  return (
    <>
      <section className="mt-7">
        <HeroRing
          value={Math.round(savingsRate)}
          label="Savings rate"
          subtitle={ringSubtitle}
          color={ringTone}
          size={240}
        />
      </section>

      <section className="mt-7">
        <StatGrid>
          <StatCard
            label="Entrate (mese)"
            value={`${formatEur(income)}`}
            unit="€"
            subtitle="totale entrato"
            status={income > 0 ? "good" : "neutral"}
            trend={cardTrend}
            trendColor="good"
          />
          <StatCard
            label="Uscite (mese)"
            value={`${formatEur(expense)}`}
            unit="€"
            subtitle="totale uscito"
            status={expense === 0 ? "neutral" : expense > income ? "bad" : "warn"}
          />
        </StatGrid>
      </section>

      {income + expense > 0 ? (
        <section className="mt-5 rounded-xl border border-border bg-surface p-5">
          <SectionHeader
            label="Flusso del mese"
            meta={`netto ${formatEur(net)} €`}
          />
          <div className="mt-4">
            <SegmentedBar
              segments={[
                { label: "Entrate", value: income, color: "bg-accent-good" },
                { label: "Uscite", value: expense, color: "bg-accent-bad" },
              ]}
            />
          </div>
        </section>
      ) : null}

      <section className="mt-5">
        <SectionHeader label="Aggiungi voce (Entrate)" />
        <div className="mt-2 rounded-xl border border-border bg-surface p-5">
          <form action={logEntry} className="space-y-2">
            {/* Sprint U3: data implicita = oggi via DateToggle.
                Tolta dalla flex row 3-col; ora il flex contiene
                solo kind + amount, più stabile sotto i 320px CSS. */}
            <DateToggle name="date" defaultDate={today} />
            <div className="flex flex-wrap gap-2">
              <label className="min-w-[7rem] flex-1">
                <span className="sr-only">Tipo: entrata o uscita</span>
                <select
                  name="kind"
                  defaultValue="income"
                  className="block min-h-[44px] w-full rounded-md border border-border bg-bg px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-info focus:ring-offset-2 focus:ring-offset-bg"
                >
                  <option value="income">Entrata</option>
                  <option value="expense">Uscita (legacy)</option>
                </select>
              </label>
              <label className="min-w-[6rem] flex-1">
                <span className="sr-only">Importo in euro</span>
                <input
                  type="number"
                  name="amount_eur"
                  required
                  min={0}
                  step="0.01"
                  placeholder="€"
                  className="block min-h-[44px] w-full rounded-md border border-border bg-bg px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-info focus:ring-offset-2 focus:ring-offset-bg"
                />
              </label>
            </div>
            <label className="block">
              <span className="sr-only">Categoria</span>
              <input
                type="text"
                name="category"
                list="finance-categories"
                maxLength={40}
                placeholder="categoria (es. stipendio, freelance)"
                className="block min-h-[44px] w-full rounded-md border border-border bg-bg px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-info focus:ring-offset-2 focus:ring-offset-bg"
              />
            </label>
            <datalist id="finance-categories">
              <option value="stipendio" />
              <option value="freelance" />
              <option value="rimborso" />
              <option value="chameleon_os" />
              <option value="varie" />
            </datalist>
            <label className="block">
              <span className="sr-only">Descrizione (opzionale)</span>
              <input
                type="text"
                name="description"
                maxLength={120}
                placeholder="descrizione (opzionale)"
                className="block min-h-[44px] w-full rounded-md border border-border bg-bg px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-info focus:ring-offset-2 focus:ring-offset-bg"
              />
            </label>
            <button
              type="submit"
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-text-primary px-4 text-sm font-medium text-bg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Salva
            </button>
          </form>
        </div>
      </section>

      <section className="mt-5">
        <SectionHeader
          label="Ultime voci"
          meta={`${recentList.length} mostrate`}
        />
        {recentList.length > 0 ? (
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-surface px-4">
            {recentList.map((e) => (
              <li key={e.id} className="flex items-center gap-3">
                <div className="flex-1">
                  <RoutineRow
                    emoji={e.kind === "income" ? "📥" : "📤"}
                    text={
                      <span>
                        <span
                          className={`tabular-nums font-semibold ${
                            e.kind === "income"
                              ? "text-accent-good"
                              : "text-accent-bad"
                          }`}
                        >
                          {e.kind === "income" ? "+" : "−"}{" "}
                          {formatEur(Number(e.amount_eur))} €
                        </span>
                        {e.category ? (
                          <span className="ml-2 text-xs text-text-muted">
                            {e.category}
                          </span>
                        ) : null}
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-text-muted">
                          {formatDateIt(e.date)}
                        </span>
                        {e.description ? (
                          <span className="ml-2 block text-xs text-text-secondary">
                            {e.description}
                          </span>
                        ) : null}
                      </span>
                    }
                    trailing={
                      <form action={deleteEntry}>
                        <input type="hidden" name="id" value={e.id} />
                        <button
                          type="submit"
                          aria-label="Elimina"
                          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-text-muted hover:text-accent-bad focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      </form>
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-text-secondary">
            Ancora nessuna voce. Inizia col form sopra.
          </p>
        )}
      </section>
    </>
  );
}

// ============================================================
// Uscite tab — NEW (personal_expenses)
// ============================================================

async function ExpensesTab({
  supabaseUserId,
  today,
  monthStart,
  editId,
}: {
  supabaseUserId: string;
  today: string;
  monthStart: string;
  editId: string | null;
}) {
  const supabase = await createClient();

  let editEntry: ExpenseRow | null = null;
  if (editId) {
    const { data } = await supabase
      .from("personal_expenses")
      .select("id, expense_date, amount, category, note")
      .eq("id", editId)
      .eq("user_id", supabaseUserId)
      .maybeSingle<ExpenseRow>();
    editEntry = data ?? null;
    if (!editEntry) redirect("/finance?tab=expenses");
  }

  const [{ data: recentRaw }, { data: monthRaw }] = await Promise.all([
    supabase
      .from("personal_expenses")
      .select("id, expense_date, amount, category, note")
      .eq("user_id", supabaseUserId)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(14),
    supabase
      .from("personal_expenses")
      .select("amount, category")
      .eq("user_id", supabaseUserId)
      .gte("expense_date", monthStart),
  ]);
  const recent = (recentRaw ?? []) as ExpenseRow[];

  // Aggregate month totals + breakdown.
  let monthTotal = 0;
  let monthCount = 0;
  const byCategory = new Map<Category, number>();
  for (const r of (monthRaw ?? []) as Array<{
    amount: string | number;
    category: Category;
  }>) {
    const v = Number(r.amount);
    if (!Number.isFinite(v)) continue;
    monthTotal += v;
    monthCount += 1;
    byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + v);
  }
  // Build a sorted breakdown (desc by amount). Render only the
  // top 6 to keep the strip readable; "altro" surfaces naturally
  // if it grows.
  const breakdown = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const breakdownMax = breakdown[0]?.[1] ?? 0;

  const isEdit = editEntry !== null;
  const formAction = isEdit ? updateExpense : addExpense;
  const submitLabel = isEdit ? "Salva modifiche" : "+ Spesa";

  const initialValues = editEntry
    ? {
        id: editEntry.id,
        expense_date: editEntry.expense_date,
        amount: Number(editEntry.amount),
        category: editEntry.category,
        note: editEntry.note,
      }
    : undefined;

  return (
    <>
      {/* Stat strip */}
      <section className="mt-7">
        <StatGrid>
          <StatCard
            label="Totale mese"
            value={`${formatEur(monthTotal)}`}
            unit="€"
            subtitle={`${monthCount} ${monthCount === 1 ? "spesa" : "spese"}`}
            status={monthTotal > 0 ? "warn" : "neutral"}
          />
          <StatCard
            label="Media per spesa"
            value={`${formatEur(monthCount > 0 ? monthTotal / monthCount : 0)}`}
            unit="€"
            subtitle="del mese"
            status="neutral"
          />
        </StatGrid>
      </section>

      {/* Breakdown per categoria — barre orizzontali top 6. */}
      {breakdown.length > 0 ? (
        <section className="mt-5 rounded-xl border border-border bg-surface p-5">
          <SectionHeader
            label="Breakdown del mese"
            meta={`${breakdown.length}/${CATEGORIES.length} categorie`}
          />
          <ul className="mt-3 space-y-2">
            {breakdown.map(([cat, val]) => {
              const pct = breakdownMax > 0 ? (val / breakdownMax) * 100 : 0;
              return (
                <li key={cat}>
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="text-text-secondary">{cat}</span>
                    <span className="tabular-nums text-text-muted">
                      {formatEur(val)} €
                    </span>
                  </div>
                  <div
                    className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-bg"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full rounded-full bg-accent-energy/60"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Form (add or edit) */}
      <section className="mt-5">
        <SectionHeader
          label={isEdit ? "Modifica spesa" : "Nuova spesa"}
          meta={
            isEdit && editEntry ? formatDateIt(editEntry.expense_date) : ""
          }
        />
        <div className="mt-2 rounded-xl border border-border bg-surface p-5">
          <ExpenseForm
            today={today}
            action={formAction}
            initialValues={initialValues}
            submitLabel={submitLabel}
          />

          {isEdit && editEntry ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/finance?tab=expenses"
                className="inline-flex min-h-[44px] items-center rounded-md border border-border px-3 text-sm text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                Annulla
              </Link>
              <form action={deleteExpense} className="flex-1">
                <input type="hidden" name="id" value={editEntry.id} />
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-accent-bad/40 bg-bg px-4 text-sm text-accent-bad transition-colors hover:bg-accent-bad/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                >
                  Cancella spesa
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </section>

      {/* Lista recenti */}
      <section className="mt-5">
        <SectionHeader
          label="Spese recenti"
          meta={recent.length > 0 ? `${recent.length}` : "vuoto"}
        />
        {recent.length > 0 ? (
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-surface px-4">
            {recent.map((e) => (
              <li key={e.id}>
                <RoutineRow
                  emoji="📤"
                  text={
                    <span>
                      <span className="tabular-nums font-semibold text-accent-bad">
                        − {formatEur(Number(e.amount))} €
                      </span>
                      <span className="ml-2 text-xs text-text-muted">
                        {e.category}
                      </span>
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-text-muted">
                        {formatDateIt(e.expense_date)}
                      </span>
                      {e.note ? (
                        <span className="mt-0.5 block text-xs text-text-secondary">
                          {e.note}
                        </span>
                      ) : null}
                    </span>
                  }
                  trailing={
                    <Link
                      href={`/finance?tab=expenses&edit=${e.id}`}
                      aria-label={`Modifica spesa del ${formatDateIt(e.expense_date)}`}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      <span aria-hidden="true">✏️</span>
                    </Link>
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-text-secondary">
            Nessuna spesa registrata. Aggiungi la prima dal form sopra.
          </p>
        )}
      </section>
    </>
  );
}
