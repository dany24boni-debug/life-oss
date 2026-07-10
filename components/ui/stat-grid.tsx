// StatGrid — 2-col grid wrapper for StatCard children.

import type { ReactNode } from "react";

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}
