/**
 * Segnale "è successa una mutazione locale" — il filo sottile tra lo strato
 * dati e il sync engine, senza che i due si importino a vicenda.
 *
 * `withMutationSignal` decora un fascio di Repos: dopo ogni mutazione
 * riuscita (riconoscibile perché i port restituiscono `Result`, cioè un
 * oggetto con la chiave `ok` — le letture restituiscono dati semplici)
 * notifica i listener. Il sync engine si iscrive e fa il suo push
 * debounced; per gli ospiti non c'è engine e la notifica cade nel vuoto.
 */

import type { Repos } from "../ports";

type Listener = () => void;

const listeners = new Set<Listener>();

export function notifyLocalMutation(): void {
  for (const listener of [...listeners]) listener();
}

export function onLocalMutation(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function isOkResult(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    (value as { ok: unknown }).ok === true
  );
}

function wrapRepo<T extends object>(repo: T): T {
  return new Proxy(repo, {
    get(target, prop, receiver) {
      const member = Reflect.get(target, prop, receiver);
      if (typeof member !== "function") return member;
      return (...args: unknown[]) => {
        const out = member.apply(target, args);
        if (out instanceof Promise) {
          return out.then((res) => {
            if (isOkResult(res)) notifyLocalMutation();
            return res;
          });
        }
        return out;
      };
    },
  });
}

/** Decora ogni repo del fascio; le letture passano indisturbate. */
export function withMutationSignal(repos: Repos): Repos {
  return {
    tasks: wrapRepo(repos.tasks),
    events: wrapRepo(repos.events),
    esami: wrapRepo(repos.esami),
    spese: wrapRepo(repos.spese),
    sera: wrapRepo(repos.sera),
    body: wrapRepo(repos.body),
    habits: wrapRepo(repos.habits),
    planner: wrapRepo(repos.planner),
    gym: wrapRepo(repos.gym),
    stats: repos.stats,
    reminders: wrapRepo(repos.reminders),
    settings: wrapRepo(repos.settings),
  };
}
