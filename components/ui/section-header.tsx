// SectionHeader — small uppercase label above a section.
// Two patterns:
//
// 1. Legacy (label-only, used across /recap, /more, /settings, etc.):
//    <SectionHeader label="STREAK" meta="14 GIORNI" />
//
//    Renders a small uppercase tracking-wide row, mono-tag-like.
//
// 2. Pulse eyebrow+title (handoff 01-components §9):
//    <SectionHeader eyebrow="MEMORIA · 127 EVENTI" title="Timeline" />
//
//    Renders the small mono eyebrow line + a 24px display title with
//    -0.025em tracking. Used by /timeline, /insights and other "page title"
//    surfaces in the Pulse round.
//
// Both forms are non-breaking — pages that currently pass `label` keep
// working unchanged.

type LegacyProps = {
  label: string;
  meta?: string;
  eyebrow?: undefined;
  title?: undefined;
};

type PulseProps = {
  eyebrow: string;
  title: string;
  meta?: string;
  label?: undefined;
};

export function SectionHeader(props: LegacyProps | PulseProps) {
  // Discriminate on the LEGACY required field. If `label` is present and
  // defined, this is a legacy call; otherwise treat as Pulse. This is more
  // defensive than discriminating on `title`: a future change that makes
  // `title` optional on PulseProps wouldn't silently break the dispatch,
  // and a caller that spreads `{...somePulseObj, label: undefined}` still
  // routes correctly.
  if ("label" in props && props.label !== undefined) {
    const { label, meta } = props;
    return (
      <div className="flex items-baseline justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]">
        <span className="text-text-muted">{label}</span>
        {meta ? (
          <span className="text-text-muted/70">
            <span aria-hidden="true" className="mr-2">·</span>
            {meta}
          </span>
        ) : null}
      </div>
    );
  }

  // Pulse eyebrow + 24px title form.
  const { eyebrow, title, meta } = props as PulseProps;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="text-[10px] font-semibold uppercase text-text-muted"
          style={{ letterSpacing: "var(--tracking-mono-md, 0.12em)" }}
        >
          {eyebrow}
        </span>
        {meta ? (
          <span
            className="text-[10px] uppercase text-text-muted/70 font-mono"
            style={{ letterSpacing: "var(--tracking-mono-md, 0.12em)" }}
          >
            {meta}
          </span>
        ) : null}
      </div>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-text-primary">
        {title}
      </h2>
    </div>
  );
}
