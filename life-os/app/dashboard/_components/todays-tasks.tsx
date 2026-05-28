import { generateTodayTasks, rolloverYesterday, toggleTask } from "../actions";

type Task = {
  id: string;
  module: string;
  title: string;
  weight: "HEAVY" | "MEDIUM" | "LIGHT";
  completed: boolean;
  rolled_from_date: string | null;
};

const MODULE_LABEL: Record<string, string> = {
  gym: "Gym",
  health: "Health",
  finance: "Finance",
  chameleon_os: "Chameleon OS",
  studio: "Studio",
  general: "Generale",
};

const WEIGHT_DOT: Record<Task["weight"], string> = {
  HEAVY: "bg-accent-bad",
  MEDIUM: "bg-accent-warn",
  LIGHT: "bg-accent-good",
};

export function TodaysTasks({ tasks, dateLabel }: { tasks: Task[]; dateLabel: string }) {
  if (tasks.length === 0) {
    return (
      <article className="rounded-xl border border-border bg-surface p-5">
        <header className="flex items-baseline justify-between">
          <p className="text-xs uppercase tracking-wide text-text-muted">Oggi — {dateLabel}</p>
        </header>
        <p className="mt-3 text-sm text-text-secondary">
          Nessun task per oggi. Genera la lista in base al tuo stato e ai moduli attivi.
        </p>
        <div className="mt-4 flex gap-2">
          <form action={generateTodayTasks}>
            <button
              type="submit"
              className="rounded-md bg-text-primary px-3 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90"
            >
              Genera oggi
            </button>
          </form>
          <form action={rolloverYesterday}>
            <button
              type="submit"
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-secondary transition-opacity hover:opacity-90"
            >
              Rollover ieri
            </button>
          </form>
        </div>
      </article>
    );
  }

  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;
  const pct = Math.round((done / total) * 100);

  // Sort: HEAVY → MEDIUM → LIGHT, completed go to bottom within each weight.
  const order: Record<Task["weight"], number> = { HEAVY: 0, MEDIUM: 1, LIGHT: 2 };
  const sorted = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return order[a.weight] - order[b.weight];
  });

  return (
    <article className="rounded-xl border border-border bg-surface p-5">
      <header className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-wide text-text-muted">Oggi — {dateLabel}</p>
        <p className="text-xs tabular-nums text-text-secondary">
          {done}/{total} • {pct}%
        </p>
      </header>

      <ul className="mt-3 divide-y divide-border">
        {sorted.map((task) => (
          <li key={task.id} className="py-2.5">
            <form action={toggleTask}>
              <input type="hidden" name="task_id" value={task.id} />
              <input type="hidden" name="next_completed" value={task.completed ? "false" : "true"} />
              <button
                type="submit"
                className="flex w-full items-start gap-3 text-left"
              >
                <span
                  className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    task.completed ? "border-accent-good bg-accent-good" : "border-border"
                  }`}
                >
                  {task.completed ? (
                    <svg viewBox="0 0 16 16" className="h-2.5 w-2.5 text-bg" aria-hidden="true">
                      <path
                        d="M3 8l3 3 7-7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </span>
                <span className="flex-1 space-y-0.5">
                  <span
                    className={`block text-sm leading-snug ${
                      task.completed ? "text-text-muted line-through" : "text-text-primary"
                    }`}
                  >
                    {task.title}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-text-muted">
                    <span className={`h-1.5 w-1.5 rounded-full ${WEIGHT_DOT[task.weight]}`} />
                    <span>{task.weight}</span>
                    <span aria-hidden="true">•</span>
                    <span>{MODULE_LABEL[task.module] ?? task.module}</span>
                    {task.rolled_from_date ? (
                      <>
                        <span aria-hidden="true">•</span>
                        <span className="text-accent-warn">rollover</span>
                      </>
                    ) : null}
                  </span>
                </span>
              </button>
            </form>
          </li>
        ))}
      </ul>
    </article>
  );
}
