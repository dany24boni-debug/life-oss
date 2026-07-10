# Partner setup — shared-branch onboarding

Welcome. This branch is a fork of a personal productivity app. The owner-private business modules have been removed from the source tree; what remains is the core engine (dashboard, gym, health, finance, agenda, recap, custom modules, settings) plus the shared **Chameleon OS** module under `/business/chameleon-os`.

This document is the minimum you need to clone, configure, and run your own instance.

---

## 1. Prerequisites

- **Node.js 20+** (the CI runner uses Node 20; older versions may work but are not tested)
- **npm** (bundled with Node)
- **Supabase account** — create one at <https://supabase.com> (free tier is enough to start)
- **Anthropic API key** — only needed if you want Today's Call + Overseer chat with real LLM responses. Without the key, those features degrade gracefully to deterministic stubs.
- **Google Cloud project** — only needed for the `/agenda` Google Calendar integration (read-only). Optional.

---

## 2. Clone + install

```bash
git clone <repo-url> life-os
cd life-os
npm install
```

If `npm install` complains about `server-only` or peer dependency warnings, run `npm ci` instead (cleaner reproducible install from `package-lock.json`).

---

## 3. Supabase project

1. **Create a fresh Supabase project** at <https://supabase.com/dashboard>. Region: pick whichever is closest to you.
2. From the project's **Settings → API** page, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret → `SUPABASE_SERVICE_ROLE_KEY` (server-only — never expose to client)
3. From **Settings → Access Tokens** (or **Account → Access Tokens** in newer UI), create a Personal Access Token. Save as `SUPABASE_ACCESS_TOKEN` — used by the migration scripts.
4. **Auth → URL Configuration**: add `http://localhost:3000/auth/callback` to the Redirect URLs allowlist. Add your production URL too when you deploy.

---

## 4. Environment

```bash
cp .env.local.example .env.local
```

Fill in the values you collected:

| Variable | Where | Required for |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API settings | Everything |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase API settings | Everything |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase API settings | Server-side queries |
| `SUPABASE_ACCESS_TOKEN` | Supabase Account tokens | Running migrations |
| `ANTHROPIC_API_KEY` | <https://console.anthropic.com> | Today's Call + Overseer (optional) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` in dev | Everything |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Google Cloud Console | `/agenda` Google Calendar (optional) |
| `TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` | OAuth token encryption (Google) |

`.env.local` is gitignored. Never commit it.

---

## 5. Run migrations

Apply each migration in order. The script uses your `SUPABASE_ACCESS_TOKEN` to talk to the Supabase Management API (no `psql` needed locally).

```bash
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0001_init.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0002_fix_profile_trigger.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0003_drop_legacy_email_check.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0004_add_lifeos_columns.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0005_phase2_schema.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0006_phase3_modules.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0007_phase6_private_modules.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0008_phase7_custom_modules.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0009_harden_admin_tables.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0010_events_and_insights.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0011_phase8_external_calendar.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0012_security_hardening.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0013_evening_planner.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0014_exams.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0015_diario_folder.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0016_gym_sessions.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0016_remove_hardcoded_owner_email.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0017_personal_expenses.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0018_grant_profiles_to_authenticated.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0019_sync_tables.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0020_push_subscriptions.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0021_lo_esami.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0022_lo_spese.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0023_lo_sera.sql
```

Two gotchas: **both 0016 files** (`0016_gym_sessions.sql` **and**
`0016_remove_hardcoded_owner_email.sql`) share the number — apply both. And **`lo_push` is
redeclared** by 0021 / 0022 / 0023 with a growing allowlist — apply them **in order** (0023 is
the final version). Migrations 0019-0023 add the local-first sync layer (`lo_*` mirror tables).

Verify the schema is intact:

```bash
node --env-file=.env.local scripts/verify-schema.mjs
```

---

## 6. Promote your account to owner

After you've signed up via the magic-link login (next step), promote yourself:

```bash
node --env-file=.env.local scripts/promote-to-owner.mjs you@example.com
```

This sets `is_owner = true` on your `profiles` row and seeds `private_modules_whitelist` with `chameleon_os` so you can see the `/business/chameleon-os` route. Re-running is safe (no-op on already-owner accounts).

---

## 7. Run the app

```bash
npm run dev
```

Open <http://localhost:3000>. The first visit redirects you to `/login` — enter your email, click the magic link in your inbox, and you're in. Complete the 6-step onboarding.

---

## 8. Deploy to Vercel (optional)

1. Push to your own GitHub repo.
2. Import on <https://vercel.com/new>.
3. Copy the env vars from `.env.local` into Vercel project settings. Mark `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`, `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_SECRET`, and `TOKEN_ENCRYPTION_KEY` as **Sensitive**.
4. After the first deploy, add `<your-vercel-url>/auth/callback` to the Supabase Auth → URL Configuration Redirect URLs.
5. On your phone, open the production URL in Safari → Share → **Add to Home Screen** for the PWA experience.

---

## 9. Verify everything works

```bash
# Type-check
npm run typecheck

# Lint
npm run lint

# Sentinel grep (blocks reintroduction of any owner-personal sentinel patterns)
npm run lint:sentinels

# Tests
npm test

# Production build
npm run build
```

All five should pass clean. CI (`.github/workflows/ci.yml`) runs the same checks
(lint · typecheck · sentinels · tests · build) on every push/PR to `main`.

---

## 10. What's where

- `app/` — Next.js App Router pages and server actions
- `lib/` — pure logic (task generator, voglia engine, overseer, module registry)
- `components/ui/` — design-system primitives (StatCard, HeroRing, BottomNav, etc.)
- `supabase/migrations/` — idempotent SQL migrations
- `scripts/` — Node utilities (run-migration, promote-to-owner, verify-schema, check-sentinels)
- `lib/modules/` — module registry (auto-discovers modules at boot via `private-boot.ts` dispatch)

The module registry is the key extension point: to add your own business module, drop a `register.ts` next to its `page.tsx` and import it from `lib/modules/private-boot.ts`. See `lib/modules/README.md` for the API and an example.

---

## 11. Help

If anything is broken at any step, open an issue or ask the original owner. The CI logs (GitHub Actions) and the smoke-test commands in section 9 are the best diagnostic surface.

Good luck. Happy shipping.
