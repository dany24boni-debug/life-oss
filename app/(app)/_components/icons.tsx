// Icone della navigazione — SVG inline a tratto, currentColor, niente
// dipendenze. Componenti puri: utilizzabili sia in server sia in client
// component.

type IconProps = { className?: string };

function base(className?: string) {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    className,
  };
}

export function IconToday({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="8.25" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconTasks({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="m8.6 12.2 2.3 2.3 4.5-4.8" />
    </svg>
  );
}

export function IconCalendar({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="4" y="5.5" width="16" height="14.5" rx="3" />
      <path d="M4 10h16" />
      <path d="M8.5 3.5v3M15.5 3.5v3" />
    </svg>
  );
}

export function IconGym({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M7 8.5v7M4.5 10v4M17 8.5v7M19.5 10v4M7 12h10" />
    </svg>
  );
}

export function IconStats({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M5 19.5V13M12 19.5V5.5M19 19.5v-9" />
    </svg>
  );
}

export function IconSettings({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4.2v2.1M12 17.7v2.1M4.2 12h2.1M17.7 12h2.1M6.5 6.5l1.5 1.5M16 16l1.5 1.5M17.5 6.5 16 8M8 16l-1.5 1.5" />
    </svg>
  );
}

/* ── Icone del modulo Task (aggiunte run-03, stesso stile a tratto) ────── */

export function IconPlus({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 5.5v13M5.5 12h13" />
    </svg>
  );
}

export function IconCheck({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="m5.5 12.5 4 4L18.5 7" />
    </svg>
  );
}

export function IconClock({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function IconTrash({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M5 7h14M10 7V5.5A1.5 1.5 0 0 1 11.5 4h1A1.5 1.5 0 0 1 14 5.5V7" />
      <path d="M6.5 7l.8 11a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-11" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

export function IconDots({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconGrip({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="9" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="17.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="17.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconChevronRight({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="m9.5 6 6 6-6 6" />
    </svg>
  );
}

export function IconBell({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M6 16.5v-6a6 6 0 0 1 12 0v6l1.5 2.5H4.5L6 16.5Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IconDownload({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 4v11M7.5 11 12 15.5 16.5 11" />
      <path d="M5 19.5h14" />
    </svg>
  );
}

/** Esami: tocco accademico, un libro aperto (run-05 prompt 3). */
export function IconExam({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 6.5C10.2 5 7.8 4.5 4.5 4.5v13c3.3 0 5.7.5 7.5 2 1.8-1.5 4.2-2 7.5-2v-13c-3.3 0-5.7.5-7.5 2Z" />
      <path d="M12 6.5v13" />
    </svg>
  );
}

/** Spese: un portafoglio essenziale (run-05 prompt 4). */
export function IconWallet({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3.5" y="6" width="17" height="13" rx="3" />
      <path d="M3.5 10h17" />
      <path d="M15.5 14.5h2" />
    </svg>
  );
}

/** Sera: una luna quieta (run-05 prompt 5). */
export function IconMoon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" />
    </svg>
  );
}

/** Bilancia pesapersone (modulo Corpo, run-07). */
export function IconScale({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8.5 9.5a5 5 0 0 1 7 0" />
      <path d="M12 9.5l1.5-2" />
    </svg>
  );
}

/* ── Abitudini (run-08): icona del modulo + set curato per-abitudine ──── */

/** Abitudini: il ciclo che si ripete (modulo, run-08). */
export function IconRepeat({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4.5 12a7.5 7.5 0 0 1 13-5.1" />
      <path d="M17.5 3.5v3.4h-3.4" />
      <path d="M19.5 12a7.5 7.5 0 0 1-13 5.1" />
      <path d="M6.5 20.5v-3.4h3.4" />
    </svg>
  );
}

/** Fiamma della streak per-abitudine. */
export function IconFlame({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 3.5c.5 2.5-.8 3.9-2.2 5.4C8.3 10.5 7 12 7 14.3A5 5 0 0 0 12 19a5 5 0 0 0 5-4.7c0-1.9-.9-3.3-1.9-4.6-.4 1-.9 1.6-1.7 2.1.2-2.9-.5-6-1.4-8.3Z" />
    </svg>
  );
}

function IconDrop({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 3.8c2.9 3.7 5.5 6.7 5.5 10a5.5 5.5 0 0 1-11 0c0-3.3 2.6-6.3 5.5-10Z" />
    </svg>
  );
}

function IconBook({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15.5H7.5A2.5 2.5 0 0 0 5 21V5.5Z" />
      <path d="M5 18.5A2.5 2.5 0 0 1 7.5 16H19" />
    </svg>
  );
}

function IconSteps({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M8.5 4.5c1.6 0 2.5 1.4 2.5 3.2 0 1.5-.7 2.8-2.2 2.8S6.5 9.4 6.5 8c0-1.9.6-3.5 2-3.5Z" />
      <path d="M7.5 12.5h3v1.6a1.5 1.5 0 0 1-3 0v-1.6Z" />
      <path d="M15.5 9.5c1.4 0 2 1.6 2 3.5 0 1.4-.8 2.5-2.3 2.5s-2.2-1.3-2.2-2.8c0-1.8.9-3.2 2.5-3.2Z" />
      <path d="M14.5 17.5h3v1.5a1.5 1.5 0 0 1-3 0v-1.5Z" />
    </svg>
  );
}

function IconStretch({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="5" r="1.8" />
      <path d="M12 7.5v6M12 9.5 7 7M12 9.5l5-2.5" />
      <path d="m12 13.5-3 6M12 13.5l3 6" />
    </svg>
  );
}

function IconSun({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="3.8" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" />
    </svg>
  );
}

function IconHeart({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 19.5c-4.5-3-7.5-5.8-7.5-9A4 4 0 0 1 12 8a4 4 0 0 1 7.5 2.5c0 3.2-3 6-7.5 9Z" />
    </svg>
  );
}

function IconNotebook({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="6" y="3.5" width="13" height="17" rx="2.5" />
      <path d="M4.5 7.5h3M4.5 12h3M4.5 16.5h3" />
      <path d="M10.5 8.5h4" />
    </svg>
  );
}

function IconMusic({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M9.5 17.5V6l9-1.8v11.3" />
      <circle cx="7.2" cy="17.5" r="2.3" />
      <circle cx="16.2" cy="15.5" r="2.3" />
    </svg>
  );
}

function IconBreath({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 8.5h9a2.3 2.3 0 1 0-2.2-3" />
      <path d="M4 12.5h13.5a2.5 2.5 0 1 1-2.4 3.2" />
      <path d="M4 16.5h6" />
    </svg>
  );
}

/**
 * Il set curato per-abitudine (run-08): chiave persistita → icona a
 * tratto. Le chiavi vivono in data/habits.ts (HABIT_ICON_KEYS); una
 * chiave ignota degrada alla spunta, mai un buco.
 */
export const HABIT_ICONS: Record<
  string,
  (props: IconProps) => React.ReactElement
> = {
  spunta: IconCheck,
  goccia: IconDrop,
  libro: IconBook,
  passi: IconSteps,
  stretching: IconStretch,
  sole: IconSun,
  luna: IconMoon,
  cuore: IconHeart,
  fiamma: IconFlame,
  taccuino: IconNotebook,
  musica: IconMusic,
  respiro: IconBreath,
};

/** L'icona dell'abitudine, con degrado onesto per chiavi future. */
export function HabitIcon({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  const Component = HABIT_ICONS[icon] ?? IconCheck;
  return <Component className={className} />;
}
