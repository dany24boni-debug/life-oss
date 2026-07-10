// Builds the user-context block injected into the Overseer system prompt.
// Server-only. All reads go through the user's RLS-bound supabase client.

import type { SupabaseClient } from "@supabase/supabase-js";
import { todayInTimezone } from "@/lib/tasks/generator";
// Vedi commento identico in lib/tasks/generator.ts:17 — barrel
// import garantisce boot side-effect. Closes ECC S2 TS-H1.
import { getRegisteredModules } from "@/lib/modules";

export type OverseerContext = {
  systemPrompt: string;
  // Returned for debugging / display only — not used by the model directly.
  summary: {
    state: string;
    streak: number;
    todayDone: number;
    todayTotal: number;
    activeModules: string[];
  };
};

// Il blocco "# VINCOLI BUSINESS" è stato estratto dal const
// BASE_SYSTEM monolitico e separato in:
//   - BASE_SYSTEM_HEAD: tutto fino al header "# VINCOLI BUSINESS"
//   - buildBusinessBlock(activeModules): contenuto runtime
//     generato dai registered modules con overseerContext hook
//     (registry-driven, niente hardcoded residuo)
//   - BASE_SYSTEM_TAIL: dal "# REGOLE ASSOLUTE" giù
//
// `buildSystemPrompt(activeModules)` ricompone i 3 pezzi runtime.

const BASE_SYSTEM_HEAD = `Sei il Life OS personale dell'utente — pianificatore, nutrizionista, personal trainer e stratega in un'unica entità.

# OPERATIVITÀ
- Sera (l'utente dice "domani" o "pianifica domani"): pianifica il giorno dopo.
- Domenica (l'utente dice "settimana"): fissa skeleton settimanale.
- Altre richieste: risposta diretta, 1-3 frasi, guarda il context utente sotto.

# STILE
Italiano. Frasi brevi. Coach che conosce l'utente.
Niente preamboli ("Certo!", "Ecco!"). Niente liste da 20 punti. Niente emoji decorative.
Niente coaching motivazionale, numeri non vibe.
Quando consegni un piano, chiudi sempre con: "Modifica qualcosa? Dimmi e aggiusto."

# CICLO "DOMANI"
1. Verifica gli eventi di domani nel context (Agenda) o chiedi cosa c'è.
2. UNA riga di domanda: "energia oggi 1-5? mood? qualcosa di nuovo?"
3. Dopo la risposta, piano breve:
   - Sveglia / a letto
   - Morning block (1 priorità: focus principale dell'utente)
   - Colazione (ingredienti easy, adatta alla cucina dell'utente)
   - Mid-morning snack se serve
   - Pranzo (proteine alte, kcal adatte al target nel context)
   - Afternoon block (1 priorità)
   - Cena (più leggera del pranzo)
   - Spuntini se servono
   - Allenamento sì/no (rispetta la cadenza dell'utente)
   - Wind-down + a letto
4. Per ogni block principale: 1 frase di WHY.

# CICLO "SETTIMANA"
1. Eventi 7gg avanti dal context.
2. Chiedi: impegni non a calendar? scadenze in arrivo? push business?
3. Skeleton: paragrafo per giorno, no dettaglio pasti.

# VINCOLI CIBO
- Rispetta i target del mese nel context (kcal, proteine, ecc.). Se non
  ci sono, chiedi all'utente o fai stima ragionevole per il profilo.
- Ingredienti easy, adatti alla cucina dell'utente. Veloci da preparare. Varia tra giorni.
- Porzioni in grammi o misure casalinghe.

# VINCOLI STUDIO / LAVORO
- Heavy se scadenze ≤ 4 settimane (esami, deadline business). Light se lontane.
- Giorni in presenza con commute lungo (se applicabile): scala il carico.

# VINCOLI BUSINESS`;

const BASE_SYSTEM_TAIL = `
# REGOLE ASSOLUTE
- Rispetta lo stato corrente (Esami/Scaling/Manutenzione/Recupero/Vacanza). In Recupero/Vacanza NON spingere — streak prevale.
- Streak non si rompe per colpa. Sotto soglia? Suggerisci il LIGHT più piccolo da chiudere.
- Voglia altalenante. Lascia respiro, mai zero margine.
- Niente dati inventati. Se mancano nel context, dillo.
- Fuori scope (news, codice non-life-os, gossip): 1 riga, declina.
- Non chiedere cose già nel context (calendar, task, target, stato).`;

/**
 * Costruisce il blocco "# VINCOLI BUSINESS" dal registry.
 *
 * Niente hardcoded residuo: tutti i contributors sono registered
 * modules con `overseerContext` hook. Ogni modulo registrato che
 * implementa l'hook contribuisce 0..N righe, condizionato a
 * `isActive` per l'utente corrente.
 *
 * Branch shared: solo i moduli registrati su questo branch
 * contribuiscono (vedi `lib/modules/private-boot.shared.ts`).
 * L'ordering segue il `tabOrder` del registry, poi insertion
 * order — il LLM non è sensibile a un singolo riga shuffle.
 */
function buildBusinessBlock(activeModules: string[]): string {
  const lines: string[] = [];
  for (const mod of getRegisteredModules()) {
    if (!mod.overseerContext) continue;
    const isActive = activeModules.includes(mod.id);
    const line = mod.overseerContext({ isActive });
    if (line) lines.push(line);
  }
  return lines.join("\n");
}

export async function buildOverseerContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<OverseerContext> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, chronotype, wake_time, sleep_time, timezone, is_owner")
    .eq("id", userId)
    .single();

  const timezone = profile?.timezone ?? "Europe/Rome";
  const today = todayInTimezone(timezone);
  const monthFirstDay = `${today.slice(0, 7)}-01`;

  const [
    { data: stateRow },
    { data: tasks },
    { data: streak },
    { data: targets },
    { data: goals },
    { data: activeModulesRaw },
    { data: detection },
  ] = await Promise.all([
    supabase
      .from("user_states")
      .select("state, started_at")
      .eq("user_id", userId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("daily_tasks")
      .select("title, weight, completed, module")
      .eq("user_id", userId)
      .eq("date", today)
      .order("created_at", { ascending: true }),
    supabase
      .from("user_streaks")
      .select("current_count, best_count")
      .eq("user_id", userId)
      .eq("scope", "daily")
      .maybeSingle(),
    supabase
      .from("user_monthly_targets")
      .select("module, metric, target_value, current_value")
      .eq("user_id", userId)
      .eq("month", monthFirstDay),
    supabase
      .from("user_long_term_goals")
      .select("category, text, target_date")
      .eq("user_id", userId)
      .eq("is_visible_in_why_panel", true),
    supabase
      .from("user_modules")
      .select("module_slug")
      .eq("user_id", userId)
      .eq("is_active", true),
    supabase
      .from("voglia_detections")
      .select("signal_type, intervention_chosen, detected_at, resolved_at")
      .eq("user_id", userId)
      .order("detected_at", { ascending: false })
      .limit(3),
  ]);

  const state = stateRow?.state ?? "Manutenzione";
  const activeModules = (activeModulesRaw ?? []).map((r) => r.module_slug);
  const todayDone = (tasks ?? []).filter((t) => t.completed).length;
  const todayTotal = tasks?.length ?? 0;

  const taskBlock = tasks && tasks.length > 0
    ? tasks
        .map(
          (t) =>
            `  - [${t.completed ? "x" : " "}] ${t.weight} · ${t.module} · ${t.title}`,
        )
        .join("\n")
    : "  (nessun task generato per oggi)";

  const targetBlock = targets && targets.length > 0
    ? targets
        .map((t) => {
          const cur = Number(t.current_value ?? 0);
          const tgt = Number(t.target_value);
          const pct = tgt > 0 ? Math.round((cur / tgt) * 100) : 0;
          return `  - ${t.module} ${t.metric}: ${cur}/${tgt} (${pct}%)`;
        })
        .join("\n")
    : "  (nessun target del mese)";

  const goalBlock = goals && goals.length > 0
    ? goals
        .map(
          (g) =>
            `  - ${g.category}: ${g.text}${g.target_date ? ` — entro ${g.target_date}` : ""}`,
        )
        .join("\n")
    : "  (nessun goal a 24 mesi)";

  const detectionBlock = detection && detection.length > 0
    ? detection
        .map(
          (d) =>
            `  - ${d.detected_at?.slice(0, 10) ?? ""}: ${d.signal_type}${
              d.intervention_chosen
                ? ` → ${d.intervention_chosen}`
                : d.resolved_at
                  ? " (resolved)"
                  : " (open)"
            }`,
        )
        .join("\n")
    : "  (nessuna detection recente)";

  const userContext = `\n## Context utente (${todayInTimezone(timezone)})

Profilo:
  - Nome: ${profile?.display_name ?? "ignoto"}
  - Cronotipo: ${profile?.chronotype ?? "intermediate"}
  - Sveglia: ${profile?.wake_time ?? "?"} · Sonno: ${profile?.sleep_time ?? "?"}
  - Owner: ${profile?.is_owner ? "sì" : "no"}

Stato corrente: ${state}${stateRow?.started_at ? ` (da ${stateRow.started_at.slice(0, 10)})` : ""}
Streak giornaliero: ${streak?.current_count ?? 0} (best ${streak?.best_count ?? 0})
Moduli attivi: ${activeModules.join(", ") || "(nessuno)"}

Task di oggi (${todayDone}/${todayTotal} chiusi):
${taskBlock}

Target del mese:
${targetBlock}

Why Panel (24 mesi):
${goalBlock}

Detection recenti (Voglia Engine):
${detectionBlock}
`;

  const systemPrompt =
    BASE_SYSTEM_HEAD +
    "\n" +
    buildBusinessBlock(activeModules) +
    BASE_SYSTEM_TAIL +
    userContext;

  return {
    systemPrompt,
    summary: {
      state,
      streak: streak?.current_count ?? 0,
      todayDone,
      todayTotal,
      activeModules,
    },
  };
}
