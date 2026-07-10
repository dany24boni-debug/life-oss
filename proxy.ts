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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // Guest mode (prompt 07, run-03): le superfici del gruppo (app) — "/",
  // /tasks, /calendar, /stats, /impostazioni — sono pubbliche, coi dati
  // locali al dispositivo. Le rotte legacy restano protette com'erano.
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));
  const isAuthOnly = AUTH_ONLY_PREFIXES.some((p) => path.startsWith(p));

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
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