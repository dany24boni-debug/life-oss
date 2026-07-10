# Life OS

Personal productivity Progressive Web App. Multi-user, adaptive task management.

> **Shared-branch variant.** This is the partner-facing fork. The owner-private business modules
> (registered via `lib/modules/private-boot.personal.ts`) are not present in this tree. The
> dispatch file (`lib/modules/private-boot.ts`) re-exports the no-op `.shared` stub. Only
> Chameleon OS appears under `/business`. See `PARTNER-SETUP.md` for clone-and-run instructions.

## Stato attuale

Le 7 fasi del prodotto sono code-complete su questo branch:

- ✅ **Phase 1 — Skeleton** (auth + dashboard shell)
- ✅ **Phase 2 — Core Engine** (6-step onboarding, State Engine, daily task generator, streak con protezione Recupero/Vacanza per iron rule §10.2, recap, rollover, adaptive load §10.4)
- ✅ **Phase 3 — Default modules** (Gym, Health, Finance + bottom nav 5 tab)
- ✅ **Phase 4 — Voglia Engine** (Layer B detection + Layer C intervention + mood slider + Today's Call gated da `ANTHROPIC_API_KEY`)
- ✅ **Phase 5 — Overseer AI** (scaffolding completo: `lib/overseer/context.ts` + streaming `/api/overseer` + chat overlay full-screen con focus trap; gated da `ANTHROPIC_API_KEY`)
- ✅ **Phase 6 — Private modules** (registry-driven; only `chameleon_os` is registered on this branch.)
- ✅ **Phase 7 — Custom modules + PWA polish** (counter / streak / numeric / calendar; icone PNG via Next 16 `app/icon.tsx` convention; manifest)
- ✅ **Phase 1.5 — Visual Polish Pass** (10 componenti in `components/ui/`, dashboard mock per design review, vocabolario applicato a tutte le altre rotte cablate ai dati Supabase)
- ✅ **A11y WCAG 2.2 AA**: focus-visible globale, viewport pinch-zoom, aria-label sui form, fieldset/legend sui radio/checkbox, tap target ≥36×36, dialog focus trap su Overseer, copy in italiano
- ✅ **Security hardening**: open-redirect callback chiuso, deny policies su admin tables, payload caps sull'API Overseer, timezone validation, no error disclosure

I dati di **Phase 5 (Overseer)** e **Today's Call (Haiku 4.5)** si attivano automaticamente al primo avvio dopo che hai messo `ANTHROPIC_API_KEY` in `.env.local` e riavviato il dev server.

## Stack

- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript
- Tailwind CSS v4 — dark theme via `@theme` block in `app/globals.css`
- Supabase (Postgres + Auth + RLS) via `@supabase/ssr`
- Anthropic Claude SDK — usato in Phase 4+ (Today's Call, Overseer)

## Setup

### 1. Environment

```powershell
Copy-Item .env.local.example .env.local
```

Variabili richieste:

| Variabile | Note |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del progetto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | server only |
| `SUPABASE_ACCESS_TOKEN` | PAT — usato dagli script in `scripts/` per applicare migrazioni via Management API |
| `ANTHROPIC_API_KEY` | richiesta da Phase 4 (Today's Call vero, non stub) e Phase 5 |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` in dev |

### 2. Supabase

Apply every migration in `supabase/migrations/` in sorted-filename order via the Management API. For the canonical sequence (all 18 migrations, including the idempotent rescue migrations 0003 + 0004), see [`PARTNER-SETUP.md`](PARTNER-SETUP.md#5-run-migrations). Quick example for the first three:

```powershell
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0001_init.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0002_fix_profile_trigger.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0003_drop_legacy_email_check.sql
# ... continue with 0004 through 0017 per PARTNER-SETUP.md
```

Verify schema:

```powershell
node --env-file=.env.local scripts/verify-schema.mjs
```

Auth: aggiungi `http://localhost:3000/auth/callback` ai Redirect URLs in **Authentication → URL Configuration**. Lo script `scripts/swap-project.mjs` lo fa automatico.

### 3. Run

```powershell
npm install
npm run dev
```

Apri http://localhost:3000.

## Routes

| Route | Cosa fa |
| --- | --- |
| `/login` | magic-link signup |
| `/auth/callback` | OAuth code exchange |
| `/onboarding?step=1..6` | wizard 6 step (profilo, energia, goals, moduli, stato, targets) |
| `/dashboard` | Today's Call banner + mood slider + intervention menu (se slip) o tasks + targets + streak + Why Panel |
| `/gym` | log workout, est. 1RM Brzycki, volume settimana/mese, ultime 10 sessioni |
| `/health` | water counter (target 2.5 L), daily stack 3 slot, sleep log |
| `/finance` | income/expense, savings rate, ultime 15 voci |
| `/business` (whitelisted only) | overview of registered private modules (this branch: Chameleon OS) |
| `/business/chameleon-os` | milestones + partner sync log |
| `/settings` | switch stato (5 stati), riapri onboarding |
| `/recap` | bilancio della giornata |
| `/more` | hub: recap, settings, edit goals/moduli/targets, sign out |

## Project structure

```
app/
  _components/bottom-nav.tsx         # 5 (o 6 con whitelist) tabs, condizionale
  icon.tsx                           # PWA 192×192 (Next 16 convention)
  apple-icon.tsx                     # iOS 180×180
  layout.tsx                         # dark theme, PWA meta
  page.tsx                           # redirect → /dashboard
  login/, auth/callback/             # auth surface
  onboarding/{page,actions}.tsx      # wizard controller + 6 step components in _steps/
  dashboard/                         # main UI: Today's Call, intervention menu, tasks, mood, targets, streak, why panel
  gym/, health/, finance/            # default modules (Phase 3)
  business/, business/chameleon-os/  # registered private modules on this branch (Phase 6)
  settings/                          # state switch + onboarding edit
  recap/                             # end-of-day summary
  more/                              # hub
lib/
  supabase/{client,server}.ts        # Supabase clients
  modules/                           # module registry + dispatch (S1–S5 share-prep refactor)
  tasks/generator.ts                 # daily task generator (state-aware) + streak helpers
  voglia/{detection,compute,today-call}.ts  # Voglia Engine + Today's Call
  auth/whitelist.ts                  # private modules whitelist helper
  fitness.ts                         # Brzycki est. 1RM
proxy.ts                             # session refresh + protected routes (Next 16 convention)
supabase/migrations/                 # idempotent SQL migrations
scripts/                             # Management API helpers (run-migration, verify-schema, swap-project)
```

## Iron rules (spec §10)

1. No minute-precise scheduling — blocks are containers (Morning/Afternoon/Evening).
2. **Streak NEVER breaks during intervention** (Recupero / Vacanza protect it; Voglia Layer C preserves it explicitly).
3. No shame messaging — practical tone always.
4. Adaptive load: under-completion 5+ days reduces base task count.
5. LIGHT tasks are the chain — designed to be near-impossible to skip.
6. **Private modules invisibly gated** — non-whitelisted users never see private modules in any UI surface.
7. The "Why" is one tap away (Why Panel on dashboard).

## Deploying to Vercel

1. Push to GitHub.
2. Import on https://vercel.com/new.
3. Add the env vars from `.env.local` (mark service role + PAT + anthropic as secrets).
4. After deploy, add `<production-url>/auth/callback` to Supabase Redirect URLs.
5. iPhone Safari: open URL → Share → **Add to Home Screen**.

## Owner bootstrap

Run `scripts/promote-to-owner.mjs <email>` after the owner has signed up. The script:

- Looks up the user row in `auth.users` by lowercased + NFC-normalized email.
- Sets `is_owner = true` on `public.profiles`.
- Seeds `public.private_modules_whitelist` with `chameleon_os` (the only private module registered on this branch) — idempotent via `ON CONFLICT DO NOTHING`.

Both updates run in a single CTE so the operation is atomic. Re-running is safe (no-op on already-owner accounts). Required env vars: `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_ACCESS_TOKEN` (a Supabase Personal Access Token).

```
node --env-file=.env.local scripts/promote-to-owner.mjs you@example.com
```

Historical note: migration 0007 originally contained a trigger that auto-promoted a hardcoded owner email on signup. Migration 0016 (`0016_remove_hardcoded_owner_email.sql`) drops that trigger; the script above replaces the auto-promotion logic at the application layer so a fresh clone is owner-agnostic.

## Notes

- Service worker / offline shell ancora deferred. Manifest + iOS meta + icon convention bastano per "Add to Home Screen".
- `next-pwa@5` rimosso (2026-05-10) perché abbandonato dal maintainer e portava 5 CVE HIGH in build-toolchain (`workbox-build` → `serialize-javascript` <7.0.5). Quando serve PWA passare a `@ducanh2912/next-pwa` (fork mantenuto) compatibile Next 16. Manifest + iOS meta + icon convention restano e bastano per "Add to Home Screen".
- ANTHROPIC: senza chiave, `Today's Call` mostra una frase deterministica costruita da stato + completion + detection. Mettendo la chiave + swap del path in `lib/voglia/today-call.ts`, parte la generazione vera con Haiku 4.5 cachata in `daily_calls`.

---

## Phase 8 — Agenda + Google Calendar (V0, read-only)

Nuova rotta `/agenda` (linkata da `/more`) che unifica eventi locali (kind=`calendar` di un custom module auto-creato `Agenda principale`) con eventi importati in sola lettura da Google Calendar. Branch: `feat/google-calendar-v0`.

### Componenti

| Layer | File | Cosa fa |
| --- | --- | --- |
| DB | `supabase/migrations/0011_phase8_external_calendar.sql` | tabelle `external_calendar_accounts` (token cifrati AES-256-GCM) + `external_calendar_events` (cache eventi importati con UNIQUE su `(account_id, external_id)` per dedup) — RLS `auth.uid() = user_id` |
| Crypto | `lib/crypto/token-cipher.ts` | AES-256-GCM su `node:crypto`, payload `iv.ciphertext.tag` base64url, chiave master da `TOKEN_ENCRYPTION_KEY` |
| Google client | `lib/google/calendar-client.ts` | fetch diretto agli endpoint REST pubblici Google (no SDK): `buildAuthorizationUrl`, `exchangeCodeForTokens`, `refreshAccessToken`, `getUserEmail`, `listEvents` (paginato, max 5 pagine), `revokeToken` |
| Token store | `lib/google/token-store.ts` | `getValidAccessToken(supabase, accountId)` — refresh automatico a 60s dalla scadenza, ri-cifra e persiste |
| Upsert helper | `lib/google/upsert-events.ts` | mapping puro `NormalizedEvent` → row DB; `EXTERNAL_EVENTS_CONFLICT_TARGET` allineato alla UNIQUE INDEX |
| Merge | `lib/agenda/merge.ts` | `mergeAgendaEvents(local, external)` + `partitionByCutoff(events, cutoffIso)` — sort lessicografico su ISO-8601 UTC, drop di eventi `cancelled`, fallback title `(senza titolo)` |
| OAuth route | `app/api/auth/google/start/route.ts` | genera state CSRF (32 byte hex) → cookie httpOnly+sameSite=lax (10 min TTL) → redirect a Google con scope `calendar.events.readonly + openid + email`, `access_type=offline + prompt=consent` |
| OAuth callback | `app/api/auth/google/callback/route.ts` | verifica state, exchange code → tokens, fetch email Google, encrypt + upsert → redirect `/agenda?connected=google`. Failure path → `/agenda?error=<slug>` |
| Server actions | `app/agenda/actions.ts` | `refreshGoogleCalendar()` (window [-7d, +30d]), `disconnectGoogleCalendar()` (revoke best-effort + delete cascade) |
| UI | `app/agenda/page.tsx` + `components/ui/agenda-event-row.tsx` | feed unificato split in "Prossimi 7 giorni" / "Più avanti", status pill 4 stati (not connected / connected unsynced / synced ok / sync error), source badge L/G, link al Google Calendar via `htmlLink` |

### Test (Vitest)

- `lib/crypto/token-cipher.test.ts` — 14 cases (roundtrip ASCII + Unicode, IV freschi, tamper resistance su ciphertext/tag/IV, key rotation, env validation, base64url accettato)
- `lib/google/upsert-events.test.ts` — 7 cases (field mapping, dedup-key consistency, isolamento per account, conflict-target allineato a migration)
- `lib/agenda/merge.test.ts` — 11 cases (sort interleaved cross-source, drop cancelled, fallback title, namespace id-collision-safe, partitionByCutoff)

Totale: 32 nuovi test, tutti green.

### Setup (one-time)

1. **Google Cloud Console**: crea progetto, abilita Google Calendar API, crea OAuth Client ID di tipo "Web application" su <https://console.cloud.google.com/apis/credentials>. Authorized redirect URI: `http://localhost:3000/api/auth/google/callback` (in prod aggiungi quello Vercel).
2. **Migration 0011**:
   ```powershell
   node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0011_phase8_external_calendar.sql
   ```
3. **`.env.local`**: copia da `.env.local.example` le 4 nuove righe e riempi.
   ```bash
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
   TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)
   ```
4. Riavvia il dev server. Apri `/agenda` → "Connetti Google" → autorizza → torna su `/agenda` → "Sincronizza Google".

### Sicurezza

- I token Google (access + refresh) **non** sono mai in plaintext nel DB: cifrati AES-256-GCM con chiave da env. Ruotare `TOKEN_ENCRYPTION_KEY` invalida tutti i token e forza il re-link.
- State CSRF da 256 bit, single-use (cookie cancellato su ogni exit path del callback).
- `prompt=consent` forza Google a restituire un nuovo `refresh_token` ad ogni link, evitando half-account sets se l'utente revoca e ri-collega.
- Errori OAuth → slug stabile in URL (`?error=state_mismatch` ecc.), mai body Google leakato.
- Disconnect: revoke best-effort lato Google → delete locale (cascata sugli eventi cached).

### V1 / V2 (non in V0)

- V1: Apple iCloud via CalDAV (app-specific password).
- V2: sync bidirezionale, scelta granulare di quali calendari importare/esportare, conflict resolution.
