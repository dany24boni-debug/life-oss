"use server";

/**
 * Azioni di accesso (B3.3, decisione D1): OTP email a 6 cifre come flusso
 * primario, magic link conservato come comodità same-device.
 *
 * - signIn: STESSO contratto signInWithOtp di prima (stesso emailRedirectTo,
 *   quindi il link nella mail continua a funzionare con il template attuale);
 *   cambiano solo la validazione (zod al posto del check "non vuoto") e la
 *   destinazione di successo: la schermata di inserimento codice.
 * - verifyCode: verifyOtp({ email, token, type: "email" }) — il codice si
 *   digita nel contesto in cui ti trovi, quindi PKCE, cookie jar e scanner
 *   dei link diventano irrilevanti (audit H1/H2).
 * Entrambe le azioni passano dal rate limiter in-memory esistente. Gli esiti
 * viaggiano via redirect + query string (convenzione già in uso su /login);
 * mai stringhe Supabase grezze verso l'utente.
 */

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkAndConsume } from "@/lib/rate-limit";

const EmailSchema = z.email();

/** 6 cifre esatte, dopo la normalizzazione degli spazi. */
const TokenSchema = z.string().regex(/^\d{6}$/);

// Finestre del limiter: l'invio è allineato al cooldown UI di 60s (4 invii
// per 10 minuti assorbono un retry onesto, non un martello); la verifica
// concede 5 tentativi per 15 minuti prima della pausa (copy "lockout"
// gentile, checklist punto smoke).
const SEND_WINDOW_MS = 10 * 60 * 1000;
const SEND_MAX = 4;
const VERIFY_WINDOW_MS = 15 * 60 * 1000;
const VERIFY_MAX = 5;

function loginError(message: string): never {
  redirect("/login?error=" + encodeURIComponent(message));
}

function verifyUrl(email: string, params?: Record<string, string>): string {
  const q = new URLSearchParams({ email, ...params });
  return `/login/verify?${q.toString()}`;
}

export async function signIn(formData: FormData) {
  const parsed = EmailSchema.safeParse(
    String(formData.get("email") ?? "").trim().toLowerCase(),
  );
  if (!parsed.success) {
    loginError("Inserisci un indirizzo email valido.");
  }
  const email = parsed.data;

  const gate = checkAndConsume(`otp_send:${email}`, SEND_WINDOW_MS, SEND_MAX);
  if (!gate.allowed) {
    const waitMin = Math.max(1, Math.ceil(gate.retryAfterMs / 60000));
    redirect(
      verifyUrl(email, {
        error: `Hai già richiesto diversi codici. Aspetta ${
          waitMin === 1 ? "un minuto" : `${waitMin} minuti`
        } e riprova.`,
      }),
    );
  }

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback`,
    },
  });

  if (error) {
    // Copia nostra, mai il messaggio Supabase grezzo (audit A4 nota 1).
    loginError(
      "Non ho potuto inviare l'email. Aspetta un momento e riprova.",
    );
  }

  redirect(verifyUrl(email, { sent: "1" }));
}

export async function verifyCode(formData: FormData) {
  const emailParsed = EmailSchema.safeParse(
    String(formData.get("email") ?? "").trim().toLowerCase(),
  );
  if (!emailParsed.success) {
    loginError("Sessione di verifica non valida. Riparti dall'email.");
  }
  const email = emailParsed.data;

  // Il codice arriva anche incollato con spazi ("123 456"): normalizza
  // prima di validare.
  const tokenParsed = TokenSchema.safeParse(
    String(formData.get("token") ?? "").replace(/\s+/g, ""),
  );
  if (!tokenParsed.success) {
    redirect(
      verifyUrl(email, { error: "Il codice è di 6 cifre. Controlla l'email." }),
    );
  }
  const token = tokenParsed.data;

  const gate = checkAndConsume(
    `otp_verify:${email}`,
    VERIFY_WINDOW_MS,
    VERIFY_MAX,
  );
  if (!gate.allowed) {
    const waitMin = Math.max(1, Math.ceil(gate.retryAfterMs / 60000));
    redirect(
      verifyUrl(email, {
        error: `Troppi tentativi per ora. Fai una pausa di ${
          waitMin === 1 ? "un minuto" : `${waitMin} minuti`
        }, poi richiedi un nuovo codice.`,
      }),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    const remaining = Math.max(0, gate.limit - gate.current);
    const tail =
      remaining <= 2
        ? remaining === 0
          ? " Poi servirà una piccola pausa."
          : ` Ti ${remaining === 1 ? "resta 1 tentativo" : `restano ${remaining} tentativi`}.`
        : "";
    redirect(
      verifyUrl(email, {
        error: `Codice non corretto o scaduto. Riprova o richiedi un nuovo codice.${tail}`,
      }),
    );
  }

  // Stessa destinazione del callback del magic link: la Oggi nuova
  // (run-04, prompt 08 — un account appena verificato atterra sulla shell,
  // non sulla dashboard legacy).
  redirect("/");
}
