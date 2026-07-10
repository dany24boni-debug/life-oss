// Avatar — circular initial-on-surface badge.
//
// Ricollocato 1:1 da app/dashboard/_components/avatar.tsx (run-05
// prompt 1): l'unico consumatore vivo è /more, la cartella d'origine è
// morta col ritiro della dashboard mock.

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <div
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full border border-border bg-gradient-to-br from-surface to-bg text-base font-semibold tracking-tight text-text-primary"
      style={{ width: size, height: size }}
    >
      {initial}
    </div>
  );
}
