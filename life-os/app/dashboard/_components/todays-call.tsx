type ColorTag = "GREEN" | "YELLOW" | "RED" | "RECUPERO" | "VACANZA";

const TONE: Record<ColorTag, string> = {
  GREEN: "border-accent-good/40 bg-accent-good/10 text-accent-good",
  YELLOW: "border-accent-warn/40 bg-accent-warn/10 text-accent-warn",
  RED: "border-accent-bad/40 bg-accent-bad/10 text-accent-bad",
  RECUPERO: "border-accent-info/40 bg-accent-info/10 text-accent-info",
  VACANZA: "border-accent-energy/40 bg-accent-energy/10 text-accent-energy",
};

export function TodaysCallBanner({ text, colorTag }: { text: string; colorTag: ColorTag }) {
  // Strip the leading TAG from the text — we render the tag separately as a chip.
  const stripped = text.replace(/^(GREEN|YELLOW|RED|RECUPERO|VACANZA)\.\s*/i, "");
  return (
    <article className={`rounded-xl border p-4 ${TONE[colorTag]}`}>
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-current px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
          {colorTag}
        </span>
        <span className="text-xs uppercase tracking-wide opacity-60">Today&apos;s Call</span>
      </div>
      <p className="mt-2 text-sm leading-snug text-text-primary">{stripped}</p>
    </article>
  );
}
