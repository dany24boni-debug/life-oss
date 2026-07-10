/**
 * Logica pura dell'install UX PWA (run-05 prompt 2, stub 13) — separata
 * dai componenti per essere testabile. Le letture da localStorage passano
 * da parse difensivi (convenzione B3.7: storage esterno = input non
 * fidato; qui senza zod perché il fence del prompt non copre
 * lib/validation — parsing stretto equivalente, documentato).
 */

/** Chiavi localStorage (per-dispositivo, mai sincronizzate). */
export const PWA_VISITS_KEY = "lifeos.pwa.visits";
export const PWA_CARD_DISMISSED_KEY = "lifeos.pwa.installCardDismissed";

/** Aperture dell'app prima di proporre (con gentilezza) l'installazione. */
export const INSTALL_CARD_MIN_VISITS = 3;

/** Parse difensivo del contatore visite: intero 0..10000, altrimenti 0. */
export function parseVisits(raw: string | null | undefined): number {
  if (raw == null) return 0;
  if (!/^\d{1,5}$/.test(raw)) return 0;
  const n = Number(raw);
  return n > 10_000 ? 10_000 : n;
}

/** Parse difensivo del flag "non mostrare più" (scritto come "1"). */
export function parseDismissed(raw: string | null | undefined): boolean {
  return raw === "1";
}

export type InstallCardInput = {
  visits: number;
  dismissed: boolean;
  standalone: boolean;
  /** beforeinstallprompt catturato (Chromium/Android). */
  canPrompt: boolean;
  /** iOS Safari: niente evento, si può solo fare coaching. */
  isIos: boolean;
};

/**
 * La card su Oggi compare solo quando: l'app è stata aperta abbastanza
 * volte, non è già installata, l'utente non l'ha congedata, e su questa
 * piattaforma un'installazione è davvero possibile (prompt catturato o
 * coaching iOS) — mai promettere quello che il browser non può fare.
 */
export function shouldShowInstallCard(input: InstallCardInput): boolean {
  return (
    input.visits >= INSTALL_CARD_MIN_VISITS &&
    !input.dismissed &&
    !input.standalone &&
    (input.canPrompt || input.isIos)
  );
}

/**
 * iOS incluso iPadOS 13+ (che si presenta come "MacIntel" ma con più
 * punti di tocco). Pura: riceve i valori, non legge navigator.
 */
export function detectIos(
  userAgent: string,
  platform: string,
  maxTouchPoints: number,
): boolean {
  if (/iphone|ipad|ipod/i.test(userAgent)) return true;
  return platform === "MacIntel" && maxTouchPoints > 1;
}
