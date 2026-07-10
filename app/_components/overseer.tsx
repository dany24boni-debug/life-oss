"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

export function Overseer({ available }: { available: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Close handler — restores focus to the trigger button so keyboard users
  // don't lose their place.
  const closeOverseer = () => {
    if (streaming) return;
    setOpen(false);
    queueMicrotask(() => triggerRef.current?.focus());
  };

  // ESC closes the dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !streaming) {
        e.preventDefault();
        closeOverseer();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, streaming]);

  // Simple focus trap: when Tab leaves the dialog's last focusable, wrap
  // back to the first; Shift+Tab from the first wraps to the last. Keeps
  // keyboard users from leaking into the muted page underneath.
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", onKey);
    return () => dialog.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setError(null);
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/overseer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg =
          errBody?.message ?? errBody?.error ?? `HTTP ${res.status}`;
        setError(String(msg));
        setStreaming(false);
        return;
      }

      // Streamed text body — append to a new assistant message in real time.
      const assistantIndex = next.length;
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const reader = res.body?.getReader();
      if (!reader) {
        setError("nessun corpo risposta");
        setStreaming(false);
        return;
      }
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const snapshot = buf;
        setMessages((prev) => {
          const copy = [...prev];
          copy[assistantIndex] = { role: "assistant", content: snapshot };
          return copy;
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "errore di rete");
    } finally {
      setStreaming(false);
    }
  }

  return (
    <>
      {/* Persistent input bar — always visible, sits above the bottom nav. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+56px)] z-20 mx-auto flex max-w-md items-center gap-2 px-5"
        aria-label="Apri Overseer"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="flex w-full items-center gap-2 rounded-full border border-border bg-surface/95 px-4 py-2 text-left text-sm text-text-muted shadow-lg backdrop-blur transition-colors hover:border-text-muted">
          <OverseerDot />
          <span className="flex-1">
            {available
              ? "Chiedi all'Overseer..."
              : "Overseer offline (manca ANTHROPIC_API_KEY)"}
          </span>
        </span>
      </button>

      {/* Full-screen overlay */}
      {open ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="overseer-title"
          className="fixed inset-0 z-50 flex flex-col bg-bg/95 backdrop-blur"
        >
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <OverseerDot />
              <span id="overseer-title" className="text-sm font-medium">Overseer</span>
            </div>
            <button
              type="button"
              onClick={closeOverseer}
              disabled={streaming}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary disabled:opacity-50"
            >
              Chiudi
            </button>
          </header>

          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto px-5 py-4"
          >
            {messages.length === 0 ? (
              <div className="space-y-2 text-sm text-text-secondary">
                <p>Chiedi qualcosa di concreto. Ho il tuo stato, i task di oggi, target del mese e i goal a 24 mesi.</p>
                <p className="text-xs text-text-muted">
                  Esempi: &quot;cosa devo fare adesso&quot;, &quot;come sto andando questo mese&quot;, &quot;quale LIGHT chiudo per primo&quot;
                </p>
              </div>
            ) : null}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "ml-auto bg-text-primary text-bg"
                    : "mr-auto border border-border bg-surface text-text-primary"
                }`}
              >
                {m.content}
                {m.role === "assistant" && streaming && i === messages.length - 1 ? (
                  <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-text-muted align-middle" />
                ) : null}
              </div>
            ))}

            {error ? (
              <p className="rounded-md border border-accent-bad/40 bg-accent-bad/10 px-3 py-2 text-xs text-accent-bad">
                {error}
              </p>
            ) : null}
          </div>

          <form
            className="flex items-end gap-2 border-t border-border px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)]"
            onSubmit={(e) => {
              e.preventDefault();
              if (available) void send(input);
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (available) void send(input);
                }
              }}
              rows={1}
              maxLength={1500}
              disabled={!available || streaming}
              placeholder={
                available
                  ? "Scrivi e invia (Enter)"
                  : "Overseer offline"
              }
              className="max-h-32 flex-1 resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!available || streaming || !input.trim()}
              className="rounded-md bg-text-primary px-4 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-30"
            >
              {streaming ? "..." : "Invia"}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}

function OverseerDot() {
  return (
    <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-accent-info shadow-[0_0_8px_currentColor]" />
  );
}
