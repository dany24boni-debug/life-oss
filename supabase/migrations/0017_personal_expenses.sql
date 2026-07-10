-- Life OS — Sprint U2: Finance — Uscite tab (personal expenses).
--
-- Nuova tabella dedicata al tracking spese personali con categoria
-- categoriale chiusa (closed enum DB-side). Separata da
-- finance_entries (che tiene il modello income/expense generico
-- col category-as-free-text) per:
--   - mirror al closed enum lato app (lib/finance/auto-classify.ts)
--   - schema più stretto (amount numeric(10,2) NOT NULL, > 0)
--   - non rompere il flow Entrate esistente
--
-- finance_entries resta intatto per safety dei dati storici;
-- decommissioning futuro.
--
-- Idempotente.

create table if not exists public.personal_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  expense_date date not null,
  amount numeric(10, 2) not null,
  category text not null,
  note text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  -- Strictly positive amount. amount = 0 sarebbe spese fantasma;
  -- amount < 0 sarebbe rimborso (modello diverso, fuori scope U2).
  constraint personal_expenses_amount_positive
    check (amount > 0),
  -- Cap sensato: 99999999.99 (8 digit before decimal, 2 after) =
  -- 100M EUR. Una spesa singola che eccede questo è quasi
  -- certamente un typo — meglio rifiutare al DB.
  constraint personal_expenses_amount_max
    check (amount <= 99999999.99),
  -- Closed enum categorial. Mirror della tuple CATEGORIES che
  -- landerà in lib/finance/auto-classify.ts (commit 2).
  -- Keep this CHECK in sync con la tuple — drift = write failure.
  constraint personal_expenses_category_enum
    check (category in (
      'cibo','trasporto','svago','vestiti','casa',
      'salute','studio','tech','regalo','altro'
    ))
);

-- Idempotent guards per ognuno dei constraint.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'personal_expenses_amount_positive'
      and conrelid = 'public.personal_expenses'::regclass
  ) then
    alter table public.personal_expenses
      add constraint personal_expenses_amount_positive check (amount > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'personal_expenses_amount_max'
      and conrelid = 'public.personal_expenses'::regclass
  ) then
    alter table public.personal_expenses
      add constraint personal_expenses_amount_max check (amount <= 99999999.99);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'personal_expenses_category_enum'
      and conrelid = 'public.personal_expenses'::regclass
  ) then
    alter table public.personal_expenses
      add constraint personal_expenses_category_enum
      check (category in (
        'cibo','trasporto','svago','vestiti','casa',
        'salute','studio','tech','regalo','altro'
      ));
  end if;
end $$;

-- Two index access patterns:
-- 1. Lista spese recenti per /finance Uscite tab → ORDER BY expense_date desc
-- 2. Breakdown mensile per categoria → WHERE user_id AND expense_date >= monthStart, GROUP BY category
-- Composite index (user_id, expense_date desc) copre entrambi.
create index if not exists idx_personal_expenses_user_date
  on public.personal_expenses (user_id, expense_date desc);

-- Secondary: breakdown query a volte filtra per categoria. Index
-- separato su (user_id, category) per scenari future (filter UI).
-- Costo storage trascurabile su tabella user-scoped.
create index if not exists idx_personal_expenses_user_category
  on public.personal_expenses (user_id, category);

alter table public.personal_expenses enable row level security;

drop policy if exists "Users own personal_expenses" on public.personal_expenses;
create policy "Users own personal_expenses" on public.personal_expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at touch trigger (stesso pattern di exams + gym_sessions).
create or replace function public.touch_personal_expenses_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_personal_expenses_touch_updated_at on public.personal_expenses;
create trigger trg_personal_expenses_touch_updated_at
  before update on public.personal_expenses
  for each row execute function public.touch_personal_expenses_updated_at();

notify pgrst, 'reload schema';
