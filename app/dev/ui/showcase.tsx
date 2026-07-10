"use client";

// Ember UI showcase — every component in every meaningful state.
// Interactive by design: hover/focus states are real, overlays open live.

import { useEffect, useState } from "react";
import {
  BottomSheet,
  Button,
  Calendar,
  ChartFrame,
  Checkbox,
  CommandPalette,
  DatePicker,
  EmptyState,
  Field,
  Input,
  Modal,
  ProgressBar,
  ProgressRing,
  RadioGroup,
  Select,
  Skeleton,
  SkeletonText,
  StatCard,
  Switch,
  Tabs,
  Textarea,
  TimePicker,
  ToastProvider,
  useToast,
  WeekStrip,
} from "@/ui";

export function Showcase() {
  return (
    <ToastProvider>
      <ShowcaseBody />
    </ToastProvider>
  );
}

const SELECT_OPTIONS = [
  { value: "gym", label: "Palestra", description: "Allenamenti e progressi" },
  { value: "tasks", label: "Task" },
  { value: "calendar", label: "Calendario" },
  { value: "stats", label: "Statistiche", disabled: true },
  { value: "settings", label: "Impostazioni" },
];

function ShowcaseBody() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const toast = useToast();

  // Theme on <html> so portal-rendered overlays inherit it too.
  // The attribute is Ember-namespaced; nothing else reads it.
  useEffect(() => {
    if (theme === "light") {
      document.documentElement.setAttribute("data-ember-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-ember-theme");
    }
    return () => {
      document.documentElement.removeAttribute("data-ember-theme");
    };
  }, [theme]);

  // cmd+k / ctrl+k opens the palette (playground-local binding).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="em-scope min-h-screen pb-24">
      <div className="mx-auto max-w-2xl px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="mb-10 flex items-start justify-between gap-4">
          <div>
            <p className="em-eyebrow mb-1 flex items-center gap-2">
              <span className="em-dot em-dot--live" aria-hidden="true" />
              Ember UI
            </p>
            <h1 className="em-title-lg">Playground componenti</h1>
            <p className="em-body-sm mt-1 text-[var(--em-text-3)]">
              Ogni componente, in ogni stato. Solo dev.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            Tema: {theme === "dark" ? "scuro" : "chiaro"}
          </Button>
        </header>

        {/* ── Palette ────────────────────────────────────────────── */}
        <Section title="Palette" eyebrow="tokens">
          <div className="grid grid-cols-5 gap-2">
            <SwatchVar name="ember" varName="--em-ember" />
            <SwatchVar name="salvia" varName="--em-salvia" />
            <SwatchVar name="segnale" varName="--em-segnale" />
            <SwatchVar name="surface" varName="--em-surface-2" />
            <SwatchVar name="text" varName="--em-text" />
          </div>
        </Section>

        {/* ── Typography ─────────────────────────────────────────── */}
        <Section title="Tipografia" eyebrow="display / body / mono">
          <div className="flex flex-col gap-3">
            <p className="em-display-xl">1.250</p>
            <p className="em-display">Venerdì 10</p>
            <p className="em-title-lg">Titolo schermata</p>
            <p className="em-title">Titolo sezione</p>
            <p className="em-body">
              Corpo del testo a 16px, il minimo per leggere senza sforzo.
            </p>
            <p className="em-body-sm text-[var(--em-text-2)]">
              Testo secondario a 14px per meta-informazioni.
            </p>
            <p className="em-eyebrow">Etichetta mono 12px — il pavimento</p>
          </div>
        </Section>

        {/* ── Buttons ────────────────────────────────────────────── */}
        <Section title="Button" eyebrow="4 varianti · 3 taglie · stati">
          <div className="flex flex-col gap-4">
            <Row label="varianti">
              <Button variant="primary">Aggiungi task</Button>
              <Button variant="secondary">Annulla</Button>
              <Button variant="ghost">Salta</Button>
              <Button variant="destructive">Elimina</Button>
            </Row>
            <Row label="taglie">
              <Button variant="primary" size="sm">
                Piccolo
              </Button>
              <Button variant="primary" size="md">
                Medio
              </Button>
              <Button variant="primary" size="lg">
                Grande
              </Button>
            </Row>
            <Row label="stati">
              <Button variant="primary" disabled>
                Disabilitato
              </Button>
              <Button variant="primary" loading>
                Salvataggio
              </Button>
              <Button variant="secondary" icon={<PlusIcon />}>
                Con icona
              </Button>
            </Row>
            <Button variant="primary" block>
              Larghezza piena
            </Button>
          </div>
        </Section>

        {/* ── Inputs ─────────────────────────────────────────────── */}
        <Section title="Input e Textarea" eyebrow="default · filled · error · disabled">
          <div className="flex flex-col gap-4">
            <Field label="Email" hint="La uso solo per il login.">
              {(p) => <Input {...p} type="email" placeholder="tu@esempio.com" />}
            </Field>
            <Field label="Nome" >
              {(p) => <Input {...p} defaultValue="Davide" />}
            </Field>
            <Field label="Titolo" error="Serve un titolo per salvare." required>
              {(p) => <Input {...p} placeholder="Cosa devi fare?" />}
            </Field>
            <Field label="Campo disabilitato">
              {(p) => <Input {...p} disabled placeholder="Non disponibile" />}
            </Field>
            <Field label="Note" hint="Cresce mentre scrivi, fino a 8 righe.">
              {(p) => (
                <Textarea {...p} placeholder="Aggiungi dettagli..." />
              )}
            </Field>
          </div>
        </Section>

        {/* ── Select ─────────────────────────────────────────────── */}
        <Section title="Select" eyebrow="listbox custom · tastiera · typeahead">
          <div className="flex flex-col gap-4">
            <Field label="Modulo">
              {(p) => (
                <Select {...p} options={SELECT_OPTIONS} placeholder="Scegli un modulo" />
              )}
            </Field>
            <Field label="Preselezionato">
              {(p) => (
                <Select {...p} options={SELECT_OPTIONS} defaultValue="gym" />
              )}
            </Field>
            <Field label="Con errore" error="Scegli un modulo per continuare.">
              {(p) => (
                <Select {...p} options={SELECT_OPTIONS} placeholder="Scegli un modulo" />
              )}
            </Field>
            <Field label="Disabilitato">
              {(p) => (
                <Select {...p} options={SELECT_OPTIONS} disabled placeholder="Non disponibile" />
              )}
            </Field>
          </div>
        </Section>

        {/* ── Choice controls ────────────────────────────────────── */}
        <Section title="Checkbox · Radio · Switch" eyebrow="controlli di scelta">
          <div className="flex flex-col gap-5">
            <div>
              <Checkbox label="Task completato" defaultChecked />
              <Checkbox
                label="Con descrizione"
                description="Una riga in piu sotto l'etichetta."
              />
              <Checkbox label="Indeterminato" indeterminate />
              <Checkbox label="Disabilitato" disabled />
            </div>
            <RadioGroup
              legend="Priorita"
              defaultValue="p2"
              options={[
                { value: "p1", label: "P1 — oggi" },
                { value: "p2", label: "P2 — questa settimana" },
                { value: "p3", label: "P3 — quando capita" },
                { value: "off", label: "Non disponibile", disabled: true },
              ]}
            />
            <div>
              <Switch label="Notifiche in-app" defaultChecked />
              <Switch
                label="Suono"
                description="Un tick discreto al completamento."
              />
              <Switch label="Disabilitato" disabled />
            </div>
          </div>
        </Section>

        {/* ── Date & time ────────────────────────────────────────── */}
        <Section title="DatePicker · TimePicker" eyebrow="zero input nativi">
          <div className="flex flex-col gap-4">
            <Field label="Data" hint="Popover con griglia navigabile da tastiera.">
              {(p) => <DatePicker {...p} />}
            </Field>
            <Field label="Preselezionata (oggi)">
              {(p) => <DatePicker {...p} defaultValue={todayStr()} />}
            </Field>
            <Field label="Con errore" error="Scegli una data valida.">
              {(p) => <DatePicker {...p} />}
            </Field>
            <Field label="Disabilitata">
              {(p) => <DatePicker {...p} disabled />}
            </Field>
            <Field label="Orario" hint="Scrivi (18.30) o scegli dalle colonne.">
              {(p) => <TimePicker {...p} />}
            </Field>
            <Field label="Orario preselezionato">
              {(p) => <TimePicker {...p} defaultValue="18:30" />}
            </Field>
          </div>
        </Section>

        {/* ── Calendar ───────────────────────────────────────────── */}
        <Section title="Calendar" eyebrow="griglia mese + week strip">
          <div className="em-card p-4">
            <Calendar
              defaultValue={todayStr()}
              markers={(d) => (d.endsWith("2") ? 2 : d.endsWith("5") ? 1 : 0)}
            />
          </div>
          <div className="mt-4">
            <p className="em-eyebrow mb-2">Week strip</p>
            <WeekStrip markers={(d) => (d.endsWith("3") ? 1 : 0)} />
          </div>
        </Section>

        {/* ── Overlays ───────────────────────────────────────────── */}
        <Section title="Modal · BottomSheet · CommandPalette" eyebrow="overlay">
          <Row label="apri">
            <Button onClick={() => setModalOpen(true)}>Modal</Button>
            <Button onClick={() => setSheetOpen(true)}>BottomSheet</Button>
            <Button onClick={() => setPaletteOpen(true)}>
              Palette (cmd+K)
            </Button>
          </Row>
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Eliminare 3 task?"
            description="Puoi annullare dal toast entro 5 secondi."
            footer={
              <>
                <Button variant="ghost" onClick={() => setModalOpen(false)}>
                  Annulla
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setModalOpen(false);
                    toast.show({
                      message: "3 task eliminati.",
                      tone: "neutral",
                      action: {
                        label: "Annulla",
                        onClick: () =>
                          toast.show({
                            message: "Ripristinati.",
                            tone: "success",
                          }),
                      },
                    });
                  }}
                >
                  Elimina
                </Button>
              </>
            }
          >
            <p className="em-body-sm text-[var(--em-text-2)]">
              Il focus resta intrappolato qui dentro; Esc o il velo chiudono.
            </p>
          </Modal>
          <BottomSheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title="Sposta a"
          >
            <div className="flex flex-col gap-1 pb-2">
              {["Oggi", "Domani", "Weekend", "Prossima settimana"].map((l) => (
                <Button
                  key={l}
                  variant="ghost"
                  block
                  className="justify-start"
                  onClick={() => {
                    setSheetOpen(false);
                    toast.show({ message: `Spostato: ${l}.`, tone: "success" });
                  }}
                >
                  {l}
                </Button>
              ))}
            </div>
          </BottomSheet>
          <CommandPalette
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            items={[
              { id: "t", label: "Nuovo task", group: "Azioni", hint: "N", onSelect: () => toast.show({ message: "Nuovo task." }) },
              { id: "e", label: "Nuovo evento", group: "Azioni", onSelect: () => toast.show({ message: "Nuovo evento." }) },
              { id: "g1", label: "Vai a Oggi", group: "Naviga", hint: "G T", onSelect: () => toast.show({ message: "Oggi." }) },
              { id: "g2", label: "Vai a Palestra", group: "Naviga", onSelect: () => toast.show({ message: "Palestra." }) },
              { id: "th", label: "Cambia tema", group: "Sistema", onSelect: () => setTheme((t) => (t === "dark" ? "light" : "dark")) },
            ]}
          />
        </Section>

        {/* ── Toast ──────────────────────────────────────────────── */}
        <Section title="Toast" eyebrow="undo pattern · toni">
          <Row label="mostra">
            <Button
              size="sm"
              onClick={() =>
                toast.show({
                  message: "Task completato.",
                  tone: "success",
                  action: { label: "Annulla", onClick: () => undefined },
                })
              }
            >
              Successo + undo
            </Button>
            <Button
              size="sm"
              onClick={() => toast.show({ message: "Salvato in locale." })}
            >
              Neutro
            </Button>
            <Button
              size="sm"
              onClick={() =>
                toast.show({
                  message: "Non ho potuto salvare (sei offline). Riprova.",
                  tone: "error",
                })
              }
            >
              Errore
            </Button>
          </Row>
        </Section>

        {/* ── Tabs ───────────────────────────────────────────────── */}
        <Section title="Tabs" eyebrow="frecce da tastiera">
          <Tabs
            items={[
              { value: "oggi", label: "Oggi" },
              { value: "prossimi", label: "Prossimi" },
              { value: "inbox", label: "Inbox" },
              { value: "off", label: "Archivio", disabled: true },
            ]}
          >
            {(active) => (
              <p className="em-body-sm text-[var(--em-text-2)]">
                Pannello attivo: <span className="font-medium text-[var(--em-text)]">{active}</span>
              </p>
            )}
          </Tabs>
        </Section>

        {/* ── Progress ───────────────────────────────────────────── */}
        <Section title="Progress" eyebrow="barra + anello">
          <div className="flex flex-col gap-4">
            <ProgressBar label="Completamento giornata" value={64} />
            <ProgressBar label="Obiettivo acqua" value={40} tone="salvia" />
            <ProgressBar label="Caricamento" />
            <div className="flex items-center gap-6">
              <ProgressRing label="Giornata" value={64} size={110}>
                <span className="flex flex-col items-center">
                  <span className="em-display" style={{ fontSize: 28, lineHeight: "30px" }}>
                    64%
                  </span>
                  <span className="em-eyebrow">oggi</span>
                </span>
              </ProgressRing>
              <ProgressRing label="Settimana" value={5} max={7} size={72} strokeWidth={6} tone="salvia">
                <span className="em-body em-num font-semibold">5/7</span>
              </ProgressRing>
            </div>
          </div>
        </Section>

        {/* ── StatCard ───────────────────────────────────────────── */}
        <Section title="StatCard" eyebrow="valore · delta · loading · slot">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Task oggi"
              value="6/9"
              delta={{ value: "+2", tone: "up" }}
              hint="3 rimasti"
            />
            <StatCard
              label="Volume settimana"
              value="4.250"
              unit="kg"
              delta={{ value: "-8%", tone: "down" }}
            />
            <StatCard label="Streak" value={12} unit="giorni" hint="record 18">
              <MiniBars />
            </StatCard>
            <StatCard label="Sonno" loading />
          </div>
        </Section>

        {/* ── ChartFrame ─────────────────────────────────────────── */}
        <Section title="ChartFrame" eyebrow="ready · loading · empty · error">
          <div className="flex flex-col gap-3">
            <ChartFrame
              label="ultimi 7 giorni"
              title="Completamento"
              legend={[
                { label: "Fatti", tone: "ember" },
                { label: "Obiettivo", tone: "neutral" },
              ]}
              caption="Media 71% — meglio della settimana scorsa."
            >
              <SampleChart />
            </ChartFrame>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ChartFrame title="In caricamento" state="loading" minHeight={120} />
              <ChartFrame title="Vuoto" state="empty" minHeight={120} />
              <ChartFrame title="Errore" state="error" minHeight={120} />
            </div>
          </div>
        </Section>

        {/* ── EmptyState & Skeleton ──────────────────────────────── */}
        <Section title="EmptyState · Skeleton" eyebrow="attese e assenze">
          <div className="em-card mb-4">
            <EmptyState
              heading="Nessun task per oggi"
              text="Aggiungi il primo: scrivi in linguaggio naturale, ci penso io."
              action={<Button variant="primary">Aggiungi task</Button>}
            />
          </div>
          <div className="em-card flex flex-col gap-3 p-4">
            <div className="flex items-center gap-3">
              <Skeleton circle className="h-10 w-10" />
              <SkeletonText lines={2} className="flex-1" />
            </div>
            <Skeleton className="h-24 w-full" />
          </div>
        </Section>

        <footer className="mt-14 border-t border-[var(--em-hairline)] pt-5">
          <p className="em-body-sm text-[var(--em-text-3)]">
            Ember — foundation del rebuild LifeOS. Vedi
            docs/plans/lifeos-rebuild/01-blueprint.md (B4).
          </p>
        </footer>
      </div>
    </main>
  );
}

/* ── Showcase scaffolding ─────────────────────────────────────────────── */

function Section({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-[var(--em-hairline)] pb-2">
        <h2 className="em-title">{title}</h2>
        {eyebrow ? <p className="em-eyebrow">{eyebrow}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="em-eyebrow mb-2">{label}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function SwatchVar({ name, varName }: { name: string; varName: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        className="h-12 w-full rounded-[var(--em-r-md)] shadow-[var(--em-e1)]"
        style={{ background: `var(${varName})` }}
      />
      <span className="em-eyebrow">{name}</span>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MiniBars() {
  const values = [3, 5, 4, 6, 5, 7, 6];
  const max = Math.max(...values);
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 70 24"
      className="mt-1 h-6 w-[70px]"
    >
      {values.map((v, i) => (
        <rect
          key={i}
          x={i * 10}
          y={24 - (v / max) * 24}
          width="6"
          height={(v / max) * 24}
          rx="1.5"
          fill="var(--em-ember)"
          opacity={i === values.length - 1 ? 1 : 0.45}
        />
      ))}
    </svg>
  );
}

function SampleChart() {
  const done = [60, 80, 40, 100, 70, 90, 55];
  return (
    <svg viewBox="0 0 280 120" className="h-32 w-full" role="img" aria-label="Barre di completamento degli ultimi 7 giorni">
      <line x1="0" y1="100" x2="280" y2="100" stroke="var(--em-hairline)" strokeWidth="1" />
      <line
        x1="0"
        y1="30"
        x2="280"
        y2="30"
        stroke="var(--em-text-3)"
        strokeWidth="1"
        strokeDasharray="3 4"
        opacity="0.6"
      />
      {done.map((v, i) => (
        <rect
          key={i}
          x={12 + i * 38}
          y={100 - (v / 100) * 68}
          width="22"
          height={(v / 100) * 68}
          rx="4"
          fill="var(--em-ember)"
          opacity={0.55 + (v / 100) * 0.45}
        />
      ))}
      {["l", "m", "m", "g", "v", "s", "d"].map((d, i) => (
        <text
          key={i}
          x={23 + i * 38}
          y={114}
          textAnchor="middle"
          fontSize="10"
          fontFamily="var(--em-font-mono)"
          fill="var(--em-text-3)"
        >
          {d}
        </text>
      ))}
    </svg>
  );
}

function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
