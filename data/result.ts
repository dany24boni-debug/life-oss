/**
 * Result<T> — la convenzione unica per gli esiti delle mutazioni (blueprint
 * B3.7): ogni mutazione dei port restituisce `Result<T>`, mai eccezioni
 * lasciate salire alla UI. Le letture restituiscono dati semplici e possono
 * lanciare solo per guasti imprevisti dello storage (gestiti dal canale di
 * errore delle live query).
 *
 * `message` è testo mostrabile all'utente (italiano, regole copy B4);
 * `code` è il ramo su cui la UI decide il comportamento.
 */

export type ErrorCode =
  | "validation" // input rifiutato dagli schemi zod
  | "not_found" // id inesistente o già cancellato
  | "conflict" // stato incompatibile con l'operazione
  | "storage" // guasto IndexedDB/Dexie imprevisto
  | "unavailable"; // storage non disponibile in questo contesto (es. SSR)

export type ResultError = {
  code: ErrorCode;
  message: string;
};

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: ResultError };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err<T = never>(code: ErrorCode, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

/** Type guard comodo per narrowing nelle UI e nei test. */
export function isOk<T>(r: Result<T>): r is { ok: true; data: T } {
  return r.ok;
}

/**
 * Esegue un'operazione async e converte qualsiasi eccezione in
 * `err("storage")` — il wrapper standard degli adapter locali, così nessun
 * guasto Dexie diventa un throw non gestito verso la UI.
 */
export async function attempt<T>(
  fn: () => Promise<Result<T>>,
): Promise<Result<T>> {
  try {
    return await fn();
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return err("storage", `Non ho potuto salvare sul dispositivo (${detail}).`);
  }
}
