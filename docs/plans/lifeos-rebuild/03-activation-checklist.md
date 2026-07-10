# Prompt 03 — Checklist di attivazione OTP (per Davide)

Il codice del flusso OTP è già in `feat/run-03` (schermata codice, azione
`verifyCode`, ramo `token_hash` nel callback). NON serve alcun deploy di
codice oltre al merge. Quello che manca è SOLO configurazione nel dashboard
Supabase — questi passi, in quest'ordine, per OGNI progetto Supabase attivo
(il tuo e quello di Daniele, finché restano separati per D6).

Stato prima del flip: l'email contiene solo il magic link. Il flusso NON è
rotto: la schermata codice spiega di aprire il link dallo stesso
dispositivo, e il link continua a funzionare come oggi. Dopo il flip
l'email contiene anche il codice a 6 cifre, e l'accesso cross-device
diventa la via primaria.

## 1. Template email (il flip vero e proprio)

Dashboard -> Authentication -> Emails (Email Templates) -> **Magic Link**.

Il template DEVE contenere `{{ .Token }}` (il codice a 6 cifre) ACCANTO al
link esistente — non al posto: il link resta la comodità same-device.
Suggerimento di corpo (adatta pure il tono):

```html
<h2>Il tuo accesso a LifeOS</h2>

<p>Codice di accesso (vale pochi minuti):</p>
<h1 style="letter-spacing: 0.3em; font-variant-numeric: tabular-nums;">
  {{ .Token }}
</h1>
<p>Digitalo nella schermata di verifica, da qualsiasi dispositivo.</p>

<p>Oppure, se stai leggendo dallo stesso dispositivo da cui hai chiesto
l'accesso, tocca il link:</p>
<p><a href="{{ .ConfirmationURL }}">Accedi a LifeOS</a></p>
```

Note:
- `{{ .ConfirmationURL }}` mantiene il comportamento attuale (PKCE,
  same-device). Non rimuoverlo.
- Variante ancora più robusta del link (opzionale): sostituire il link con
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email` —
  il callback ha già il ramo `token_hash` e questo formato funziona anche
  aperto su un ALTRO dispositivo (niente code verifier). Se lo fai,
  verifica prima il punto 2.
- Salva e manda un'email di prova dal pulsante del dashboard.

## 2. Redirect URLs da verificare

Dashboard -> Authentication -> URL Configuration:

- **Site URL**: l'URL di produzione (es. `https://<app>.vercel.app`).
- **Redirect URLs** devono includere, per ogni ambiente che usi:
  - `http://localhost:3000/auth/callback` (dev; adatta la porta se diversa)
  - `https://<prod>/auth/callback`
  - eventuali URL di preview Vercel se ci fai login (audit H4: un URL
    assente = redirect silenzioso alla Site URL).
- Su Vercel controlla che `NEXT_PUBLIC_APP_URL` punti all'URL di
  produzione (audit H3: il fallback è localhost e i link muoiono sul
  telefono).

## 3. Smoke test locale (10 minuti)

1. `npm run dev`, apri `/login` in una finestra normale.
2. Invia l'email col tuo indirizzo: devi atterrare su
   `/login/verify?email=...` con il banner "Email inviata".
3. Apri l'email SUL TELEFONO (dispositivo diverso): digita il codice a 6
   cifre nella finestra desktop -> devi entrare su `/dashboard`.
4. Richiedi un altro codice: il pulsante "Invia un nuovo codice" deve
   mostrare il conto alla rovescia di 60s prima di riattivarsi.
5. Codice sbagliato per 5 volte: al quinto la pagina deve mostrare la
   pausa gentile ("Troppi tentativi per ora...") SENZA stringhe Supabase
   grezze.
6. Magic link same-device: richiedi un'email e TOCCA il link dallo stesso
   browser -> devi entrare senza codice (percorso PKCE intatto).
7. (Solo se hai messo il link token_hash al punto 1) apri il link da un
   dispositivo diverso -> deve entrare comunque.

## 4. Smoke test produzione (dopo il merge + deploy)

Ripeti 2-3-6 sull'URL di produzione, con la PWA installata su iPhone:
richiedi il codice DALLA PWA, leggi l'email in Gmail, digita il codice
nella PWA. Questo è esattamente lo scenario che il magic link da solo non
copriva (cookie jar separati, audit H1).

## 5. Cosa NON è incluso (per onestà)

- Nessun cambio alla durata della sessione o al TTL dell'OTP (default di
  progetto; si regolano in Authentication -> Providers -> Email se serve).
- Il rate limit lato app è in-memory per processo (V0): il limite globale
  vero resta quello di Supabase. Sufficiente a n=2.
- Passkeys: fuori scope per decisione di blueprint (B3.3, "later").
