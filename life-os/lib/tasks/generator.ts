// Daily task generator — pure logic, no DB.
// Given a state and the user's active module slugs, returns the proposed task list
// for a single day. Deterministic shapes per state.
//
// Private-module task contributions live in each module's
// `register.ts` (taskGenerator hook). The loop `registryTasks(state,
// activeModules)` below pulls them from the runtime registry — on
// branches where a module is not registered, it contributes zero
// tasks.
//
// `chameleon_os` + base modules (studio, gym, health, finance,
// general) are hardcoded here. Base modules are "core" and not
// gated by the private-module whitelist.

// Import dal barrel `@/lib/modules` (NON da `/registry`): il
// barrel ha side-effect import di private-boot → garantisce che
// il registry sia popolato quando registryTasks() runa. Closes
// ECC S2 TS-H1. I register.ts continuano a importare da /registry
// direttamente per evitare il circular (vedi README).
import { getRegisteredModules } from "@/lib/modules";

export type Weight = "HEAVY" | "MEDIUM" | "LIGHT";

export type GeneratedTask = {
  module: string;
  title: string;
  weight: Weight;
};

export type State =
  | "Esami"
  | "Scaling"
  | "Manutenzione"
  | "Recupero"
  | "Vacanza";

/**
 * Raccogli le task contributions dai moduli registrati che hanno un
 * `taskGenerator` hook e sono attivi nel `activeModules` corrente.
 * L'ordering del registry (`tabOrder` asc, poi insertion) determina
 * l'ordine dei task contribuiti — i consumer non devono fare
 * assumptions sull'ordine relativo fra moduli registrati e moduli
 * hardcoded ancora in questo file.
 */
function registryTasks(state: State, activeModules: string[]): GeneratedTask[] {
  const out: GeneratedTask[] = [];
  for (const mod of getRegisteredModules()) {
    if (!mod.taskGenerator) continue;
    if (!activeModules.includes(mod.id)) continue;
    // isActive=true hardcoded: il check `activeModules.includes`
    // sopra garantisce l'invariant — il taskGenerator hook è
    // chiamato SOLO se il modulo è attivo. Passare il check
    // ricomputato sarebbe ridondante. Tutti i registered modules
    // gestiscono comunque `if (!isActive) return []` come guardia
    // difensiva. Closes ECC S3 TS-L1.
    for (const task of mod.taskGenerator(state, true)) {
      out.push({ module: mod.id, ...task });
    }
  }
  return out;
}

export function generateTasksFor(
  state: State,
  activeModules: string[],
): GeneratedTask[] {
  const has = (slug: string) => activeModules.includes(slug);
  const out: GeneratedTask[] = [];

  if (state === "Esami") {
    out.push({ module: "studio", title: "Blocco studio mattina (90 min)", weight: "HEAVY" });
    out.push({ module: "studio", title: "Blocco studio pomeriggio (90 min)", weight: "HEAVY" });
    out.push({ module: "studio", title: "Ripasso/esercizi serali (45 min)", weight: "MEDIUM" });
    if (has("gym")) out.push({ module: "gym", title: "Sessione gym (giorni alternati, 1h20)", weight: "MEDIUM" });
    if (has("health")) out.push({ module: "health", title: "Daily stack: acqua + creatina + sonno", weight: "LIGHT" });
    if (has("finance")) out.push({ module: "finance", title: "Tracciare spese del giorno", weight: "LIGHT" });
    // Registered modules contribute LIGHT-tier tasks here.
    out.push(...registryTasks(state, activeModules));
    return out;
  }

  if (state === "Scaling") {
    // Registered modules contribute here; insertion order +
    // tabOrder asc of the registry drives ordering.
    out.push(...registryTasks(state, activeModules));
    if (has("chameleon_os")) out.push({ module: "chameleon_os", title: "Sviluppo Chameleon OS (deep block)", weight: "HEAVY" });
    if (has("gym")) out.push({ module: "gym", title: "Sessione gym (1h)", weight: "MEDIUM" });
    if (has("health")) out.push({ module: "health", title: "Daily stack: acqua + creatina + sonno", weight: "LIGHT" });
    if (has("finance")) out.push({ module: "finance", title: "Tracciare spese del giorno", weight: "LIGHT" });
    return out;
  }

  if (state === "Recupero") {
    // Max 4 LIGHT items; streak protected. Registered modules
    // may contribute LIGHT-only tasks here.
    out.push(...registryTasks(state, activeModules));
    if (has("health")) out.push({ module: "health", title: "Acqua + creatina", weight: "LIGHT" });
    out.push({ module: "general", title: "30 min Claude Code (basta)", weight: "LIGHT" });
    out.push({ module: "general", title: "Pausa attiva: musica + camminata", weight: "LIGHT" });
    return out;
  }

  if (state === "Vacanza") {
    // Only registered modules contribute (typically LIGHT-only).
    out.push(...registryTasks(state, activeModules));
    return out;
  }

  // Manutenzione (default). Registered modules contribute first,
  // before base hardcoded tasks — insertion order + tabOrder asc
  // of the registry.
  out.push(...registryTasks(state, activeModules));
  if (has("gym")) out.push({ module: "gym", title: "Sessione gym (1h)", weight: "MEDIUM" });
  if (has("chameleon_os")) out.push({ module: "chameleon_os", title: "Avanzamento Chameleon OS", weight: "MEDIUM" });
  if (has("health")) out.push({ module: "health", title: "Daily stack: acqua + creatina + sonno", weight: "LIGHT" });
  if (has("finance")) out.push({ module: "finance", title: "Tracciare spese del giorno", weight: "LIGHT" });
  return out;
}

// LIGHT-completion threshold for streak: 80% of LIGHT tasks completed counts as a "kept day".
export const STREAK_THRESHOLD = 0.8;

// Adaptive load (spec §10 rule 4): if the user has been under 50% completion
// for 5+ days out of the last 7, reduce HEAVY count to at most 1 (or 0 in
// Recupero/Vacanza). LIGHT is preserved — it's the chain.
export function applyAdaptiveLoad(
  tasks: GeneratedTask[],
  underCompletionDaysLast7: number,
): GeneratedTask[] {
  if (underCompletionDaysLast7 < 5) return tasks;

  const lights = tasks.filter((t) => t.weight === "LIGHT");
  const mediums = tasks.filter((t) => t.weight === "MEDIUM");
  const heavies = tasks.filter((t) => t.weight === "HEAVY");

  // Keep only 1 HEAVY (the first) and drop half the MEDIUM, preserve all LIGHT.
  const trimmedHeavy = heavies.slice(0, 1);
  const trimmedMedium = mediums.slice(0, Math.ceil(mediums.length / 2));

  return [...trimmedHeavy, ...trimmedMedium, ...lights];
}

// In-presence load: on days when the user is physically on-site
// (long commute — typical university lectures, exam days, or
// in-office meetings), drop one HEAVY and halve the MEDIUM count.
// LIGHT is preserved — it's the chain. Detection of in-presence
// days is in lib/calendar/in-presence.ts (keyword-matches calendar
// events); this helper just consumes the boolean it produces.
export function applyInPresenceLoad(
  tasks: GeneratedTask[],
  isInPresence: boolean,
): GeneratedTask[] {
  if (!isInPresence) return tasks;

  const lights = tasks.filter((t) => t.weight === "LIGHT");
  const mediums = tasks.filter((t) => t.weight === "MEDIUM");
  const heavies = tasks.filter((t) => t.weight === "HEAVY");

  // Keep at most 1 HEAVY (the first), halve MEDIUM, preserve all LIGHT.
  const trimmedHeavy = heavies.slice(0, 1);
  const trimmedMedium = mediums.slice(0, Math.ceil(mediums.length / 2));

  return [...trimmedHeavy, ...trimmedMedium, ...lights];
}

export function isDayKept(tasks: { weight: Weight; completed: boolean }[]): boolean {
  const lights = tasks.filter((t) => t.weight === "LIGHT");
  if (lights.length === 0) {
    // No LIGHT tasks generated (e.g. Vacanza with no posting) — treat day as kept.
    return true;
  }
  const completed = lights.filter((t) => t.completed).length;
  return completed / lights.length >= STREAK_THRESHOLD;
}

// Today's date as YYYY-MM-DD in the given IANA timezone.
export function todayInTimezone(timezone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

// Yesterday's date in the same timezone.
export function yesterdayInTimezone(timezone: string): string {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return fmt.format(yesterday);
}
