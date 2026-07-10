"use client";

/**
 * "Invia un nuovo codice" con cooldown di 60s VISIBILE. L'istante
 * dell'ultimo invio vive in sessionStorage per email: un reload o un
 * tentativo fallito non azzerano il conto alla rovescia. Il submit riusa
 * la stessa server action dell'invio (stessi rate limit server-side: il
 * cooldown client è cortesia, non sicurezza).
 */

import { useEffect, useState } from "react";
import { signIn } from "../actions";

const COOLDOWN_S = 60;

function storageKey(email: string) {
  return `lifeos-otp-sent:${email}`;
}

export function ResendButton({ email }: { email: string }) {
  // null = non ancora montato (SSR): si rende il pulsante disabilitato
  // senza secondi, così l'idratazione non ha mismatch di testo.
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const key = storageKey(email);
    let at = Number(window.sessionStorage.getItem(key) ?? 0);
    if (!at || at > Date.now()) {
      at = Date.now();
      window.sessionStorage.setItem(key, String(at));
    }
    const tick = () =>
      setRemaining(
        Math.max(0, COOLDOWN_S - Math.floor((Date.now() - at) / 1000)),
      );
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [email]);

  const disabled = remaining === null || remaining > 0;

  return (
    <form
      action={signIn}
      onSubmit={() =>
        window.sessionStorage.setItem(storageKey(email), String(Date.now()))
      }
    >
      <input type="hidden" name="email" value={email} />
      <button
        type="submit"
        disabled={disabled}
        className="text-xs text-text-secondary underline underline-offset-4 transition-opacity hover:text-text-primary disabled:cursor-default disabled:no-underline disabled:opacity-60"
      >
        {remaining !== null && remaining > 0
          ? `Invia un nuovo codice (${remaining}s)`
          : "Invia un nuovo codice"}
      </button>
    </form>
  );
}
