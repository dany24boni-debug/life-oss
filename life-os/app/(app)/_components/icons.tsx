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
