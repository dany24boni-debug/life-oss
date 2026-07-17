"use client";

/**
 * Il boundary di casa per i mount LAZY (run-13 P5c): un chunk on-demand
 * che non arriva (offline al primo uso, deploy a cavallo) NON deve
 * abbattere la shell intera su (app)/error.tsx — l'accessorio degrada,
 * il resto vive. Fallback di default: null (l'affordance sparisce,
 * riappare al prossimo mount quando la rete torna).
 */

import { Component, type ReactNode } from "react";

export class LazyBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error("[lifeos] lazy mount fallito:", error);
  }

  render(): ReactNode {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
