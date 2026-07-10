/**
 * UUIDv7 (RFC 9562) — id client-side ordinabili per tempo di creazione.
 *
 * Perché non `crypto.randomUUID()`: genera UUIDv4, che non ordina. La
 * proprietà che il blueprint (B3.1) chiede alle chiavi primarie è l'ordine
 * lessicografico ~= ordine di creazione, così indici e merge di sync restano
 * semplici. Implementiamo v7 direttamente: 48 bit di timestamp Unix in ms,
 * versione 7, 12 bit di sequenza monotona, variant 10, 62 bit casuali.
 *
 * Monotonia: all'interno dello stesso processo due id generati in
 * sequenza ordinano SEMPRE in modo strettamente crescente, anche nello
 * stesso millisecondo (contatore a 12 bit in rand_a; all'overflow si prende
 * in prestito 1 ms, come consentito dalla RFC 9562 §6.2 metodo 1).
 */

const HEX = "0123456789abcdef";

let lastMs = 0;
let seq = 0; // 12 bit, riparte a ogni nuovo millisecondo

/**
 * Genera un UUIDv7. `now` è iniettabile per i test; se il clock arretra
 * (skew), la monotonia vince: si continua dal timestamp più alto già usato.
 */
export function uuidv7(now: number = Date.now()): string {
  if (now > lastMs) {
    lastMs = now;
    // Riparte da un valore casuale nella metà bassa del contatore: lascia
    // 2048 incrementi di margine nello stesso ms prima del prestito.
    seq = randomInt() & 0x7ff;
  } else {
    seq = (seq + 1) & 0xfff;
    if (seq === 0) lastMs += 1; // overflow: prestito di 1 ms (RFC 9562 §6.2)
  }

  const bytes = new Uint8Array(16);
  // 48 bit di timestamp big-endian. Divisioni, non shift: gli operatori
  // bitwise JS troncano a 32 bit e ms supera 2^32.
  let t = lastMs;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = t % 256;
    t = Math.floor(t / 256);
  }
  // Versione (0111) + 12 bit di sequenza in rand_a.
  bytes[6] = 0x70 | (seq >> 8);
  bytes[7] = seq & 0xff;
  // 64 bit casuali; i 2 bit alti di bytes[8] diventano la variant 10.
  const rand = new Uint8Array(8);
  crypto.getRandomValues(rand);
  bytes.set(rand, 8);
  bytes[8] = 0x80 | (bytes[8] & 0x3f);

  return format(bytes);
}

/** Estrae il timestamp (ms Unix) codificato in un UUIDv7. */
export function uuidv7Timestamp(id: string): number {
  const hex = id.replaceAll("-", "").slice(0, 12);
  return Number.parseInt(hex, 16);
}

/**
 * UUIDv8 DETERMINISTICO da una chiave testuale (run-05 prompt 5):
 * SHA-256 della chiave → primi 16 byte → bit di versione 8 e variant.
 * Stessa chiave = stesso id, su qualsiasi dispositivo — è ciò che rende
 * "una riga per giorno" del modulo Sera vera per costruzione (LWW sulla
 * stessa PK) e gli import rilanciabili. È l'UNICA implementazione della
 * derivazione (cleanup 16, run-06): app/(app)/gym/importer.ts ri-esporta
 * questa funzione col nome storico `deriveId`, usato dai quattro importer
 * legacy (gym, calendar, spese, esami) con le loro chiavi-prefisso.
 */
export async function deriveUuidV8(key: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key),
  );
  const b = new Uint8Array(digest).slice(0, 16);
  b[6] = 0x80 | (b[6] & 0x0f); // versione 8 (custom, RFC 9562 §5.8)
  b[8] = 0x80 | (b[8] & 0x3f); // variant 10
  return format(b);
}

function randomInt(): number {
  const b = new Uint8Array(2);
  crypto.getRandomValues(b);
  return (b[0] << 8) | b[1];
}

function format(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < 16; i++) {
    if (i === 4 || i === 6 || i === 8 || i === 10) out += "-";
    out += HEX[bytes[i] >> 4] + HEX[bytes[i] & 0x0f];
  }
  return out;
}
