# 👋 Leggi questo per primo

Ciao! Questo è il codebase di **Life OS** — un'app PWA personale per la
produttività: dashboard, gestione task adattivi (con streak protetti),
gym log, health log, finance log, agenda con sync Google Calendar, Overseer
AI per pianificazione, e il modulo **Chameleon OS** (il nostro progetto
condiviso) sotto `/business/chameleon-os`.

Questa è una **versione pulita** del progetto pensata per essere il tuo
punto di partenza. Puoi farne quello che vuoi: usarla così com'è, modificarla,
estenderla, ridisegnarla, rinominarla. È tua.

---

## Cosa c'è dentro

- **Frontend**: Next.js 16 + React 19 + TypeScript + Tailwind v4
- **Backend**: Supabase (Postgres + Auth + RLS) — fai il tuo project, gratis
- **AI**: integrazione opzionale con Anthropic Claude (Today's Call + Overseer
  chat). Senza chiave API, le feature degradano a stub deterministici.
- **PWA**: manifest + icone, "Add to Home Screen" funziona da iPhone Safari

Tutto **multi-utente** con Row-Level Security: anche se mostri l'URL a qualcuno,
i loro dati restano isolati dai tuoi grazie alle policy DB.

---

## Per partire

**Leggi `PARTNER-SETUP.md`** (sempre in radice di questa cartella). Sono 11
step in totale, ~30 minuti per avere l'app girante in locale, ~10 minuti
in più per deployare su Vercel.

Prerequisiti minimi:
- Node 20+
- Un account Supabase gratuito (`supabase.com`)
- Un account Anthropic per la chiave API (opzionale, solo se vuoi il
  Today's Call + Overseer veri — altrimenti girano in modalità stub senza chiave)

---

## Come usare Claude Code per aiutarti

Hai Claude Code Max. Apri questa cartella con Claude Code:

```powershell
cd <cartella-progetto>
claude
```

Poi incolla il prompt di onboarding che ti ho mandato a parte (o che trovi
nel messaggio insieme allo ZIP). Claude leggerà la struttura, il PARTNER-SETUP,
e ti guiderà step-by-step nella configurazione del tuo Supabase + nella
prima esecuzione.

Se vuoi modificare l'app (aggiungere un modulo, cambiare il design, ecc.)
basta chiederglielo in italiano normale. Il codebase è ben commentato e
Claude lo capisce velocemente.

---

## Cosa NON c'è (e perché)

Il progetto è arrivato a te dopo un refactor di pulizia: ho rimosso i miei
moduli privati personali (cose mie che non ti servono e non avrebbero
funzionato sul tuo Supabase senza i miei dati). Quello che resta è il
**core engine** completo + il modulo **Chameleon OS** che facciamo insieme.

Se cerchi nel codice e ti aspetti di trovare riferimenti a "moduli privati"
o cose simili: il **module registry** in `lib/modules/` è la struttura
generica che permette di registrare i tuoi propri moduli privati in futuro.
Vedi `lib/modules/README.md` per la doc tecnica.

---

## File chiave da leggere

| File | Cosa contiene |
| --- | --- |
| `PARTNER-SETUP.md` | Setup completo da zero (Supabase, env vars, migrazioni, owner promotion, deploy) |
| `README.md` | Overview generale dell'app, route, struttura |
| `lib/modules/README.md` | Come funziona il module registry — utile se vuoi estendere l'app |
| `.env.local.example` | Template delle variabili d'ambiente (copia in `.env.local` e riempi) |

---

## Tooling consigliato

- **Editor**: VS Code o Cursor
- **AI**: Claude Code (che hai già)
- **DB GUI**: Supabase dashboard è sufficiente; opzionalmente TablePlus o DBeaver
- **Browser per dev**: Chrome/Edge — apri DevTools per debug

---

## Domande?

Scrivi pure. Sono qui per supporto sull'onboarding. Una volta che gira in
locale + è deployato, l'app è tua e ci puoi fare quello che vuoi.

Buon divertimento.
