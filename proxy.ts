import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PREFIXES = [
  // "/dashboard" e "/agenda" rimossi (cleanup 16, run-06): ora sono redirect
  // server verso superfici PUBBLICHE (/dashboard → "/", /agenda → /calendar).
  // Un ospite con un vecchio segnalibro deve atterrarci, non sbattere sul muro
  // di login. "/commute" rimosso: la rotta non esiste più (404, nessun auth
  // richiesto). Restano protette solo le superfici legacy ancora vive.
  "/onboarding",
  "/settings",
  "/recap",
  "/body",
  // "/gym" rimosso (run-04 prompt 10): la rotta ora serve il modulo NUOVO
  // dentro la shell (app) — guest-first come /tasks e /calendar. La pagina
  // legacy che questa protezione copriva non esiste più.
  "/health",
  "/finance",
  "/more",
  "/business",
  "/custom",
  "/timeline",
  "/insights",
  // "/sera" e "/esami" rimossi (run-05, prompt 5 e 3): le rotte ora
  // servono i moduli NUOVI dentro la shell (app) — guest-first, come
  // /gym al run-04.
];
const AUTH_ONLY_PREFIXES = ["/login"];

/**
 * Tetto alla verifica auth per-richiesta (run-09 prompt 6). Con
 * Supabase irraggiungibile (progetto in pausa, DNS morto, rete giù) la
 * `getUser()` del middleware restava appesa ai timeout di rete — 36
 * secondi OSSERVATI prima che qualsiasi pagina rispondesse. Il
 * tradeoff dei 4 secondi: una verifica lenta ma viva viene troncata e
 * l'utente autenticato naviga da ospite per QUESTA richiesta (i dati
 * locali sono comunque i suoi); in cambio l'app non si impicca mai
 * dietro un server morto. Le rotte protette (solo legacy) non
 * degradano: rimandano a /login con la copy dell'imprevisto.
 */
const AUTH_TIMEOUT_MS = 4000;

/**
 * Corsa pura promise-contro-timeout: null allo scadere, il valore se
 * arriva prima. Il timer si pulisce sempre; un rigetto della promise
 * resta un rigetto (lo gestisce il chiamante). Testata in proxy.test.ts.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Copy onesta del banner di /login quando l'auth non risponde. */
export const AUTH_OFFLINE_MESSAGE =
  "Non riesco a verificare l'accesso: il server non risponde. Riprova tra qualche istante.";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Fail-fast: timeout O errore di rete = auth indisponibile, mai un
  // hang. Le superfici pubbliche (tutto il gruppo (app)) proseguono
  // SUBITO da ospite; solo le legacy protette rimandano a /login.
  let user: { id: string } | null = null;
  let authUnavailable = false;
  try {
    const result = await withTimeout(supabase.auth.getUser(), AUTH_TIMEOUT_MS);
    if (result === null) authUnavailable = true;
    else user = result.data.user;
  } catch {
    authUnavailable = true;
  }

  const path = request.nextUrl.pathname;
  // Guest mode (prompt 07, run-03): le superfici del gruppo (app) — "/",
  // /tasks, /calendar, /stats, /impostazioni — sono pubbliche, coi dati
  // locali al dispositivo. Le rotte legacy restano protette com'erano.
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));
  const isAuthOnly = AUTH_ONLY_PREFIXES.some((p) => path.startsWith(p));

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (authUnavailable) {
      // Non "non sei autenticato" ma "non ho potuto verificarlo": il
      // banner errori di /login mostra il messaggio così com'è.
      url.searchParams.set("error", AUTH_OFFLINE_MESSAGE);
    }
    return NextResponse.redirect(url);
  }

  if (isAuthOnly && user) {
    const url = request.nextUrl.clone();
    // Run-05 prompt 1: chi è già autenticato e visita /login atterra
    // sulla Oggi nuova (la dashboard legacy è un redirect a "/").
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};