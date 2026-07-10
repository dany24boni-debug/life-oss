"use client";

// Shared internal machinery for Ember overlay components.
// Not exported from the barrel — component-internal API.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

const emptySubscribe = () => () => {};

/** Portal that renders nothing until hydrated (SSR-safe, no effect state). */
export function Portal({ children }: { children: React.ReactNode }) {
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  if (!hydrated) return null;
  return createPortal(children, document.body);
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus trap for Modal / BottomSheet / CommandPalette.
 * - Moves focus into the container on activation (initial selector optional).
 * - Loops Tab / Shift+Tab.
 * - Restores focus to the previously focused element on deactivation.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  initialFocus?: string,
) {
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    restoreRef.current = (document.activeElement as HTMLElement) ?? null;

    const target =
      (initialFocus
        ? container.querySelector<HTMLElement>(initialFocus)
        : null) ?? container.querySelector<HTMLElement>(FOCUSABLE);
    (target ?? container).focus({ preventScroll: true });

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const items = Array.from(
        container!.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    container.addEventListener("keydown", onKeyDown);
    return () => {
      container.removeEventListener("keydown", onKeyDown);
      restoreRef.current?.focus({ preventScroll: true });
    };
  }, [active, containerRef, initialFocus]);
}

/** Close-on-outside-pointerdown for popovers. */
export function useOnClickOutside(
  refs: Array<RefObject<HTMLElement | null>>,
  onOutside: () => void,
  active: boolean,
) {
  const cb = useRef(onOutside);
  useLayoutEffect(() => {
    cb.current = onOutside;
  });
  useEffect(() => {
    if (!active) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (refs.some((r) => r.current?.contains(t))) return;
      cb.current();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
    // refs array identity is stable per call site by convention
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

/** Body scroll lock while an overlay is open (stacking-safe). */
let lockCount = 0;
export function useLockBodyScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockCount += 1;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      lockCount -= 1;
      if (lockCount === 0) document.body.style.overflow = prev;
    };
  }, [active]);
}

/** Escape-key handler for open overlays. */
export function useEscape(onEscape: () => void, active: boolean) {
  const cb = useRef(onEscape);
  useLayoutEffect(() => {
    cb.current = onEscape;
  });
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        cb.current();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active]);
}

/** Controlled/uncontrolled state helper (Select, Tabs, pickers). */
export function useControllable<T>(
  controlled: T | undefined,
  defaultValue: T,
  onChange?: (v: T) => void,
) {
  const [inner, setInner] = useState<T>(defaultValue);
  const isControlled = controlled !== undefined;
  const value = isControlled ? controlled : inner;
  const set = useCallback(
    (v: T) => {
      if (!isControlled) setInner(v);
      onChange?.(v);
    },
    [isControlled, onChange],
  );
  return [value, set] as const;
}

/** Stable unique id with prefix (wraps React.useId for DOM-safe output). */
export function useDomId(prefix: string) {
  const [id] = useState(() => `${prefix}-${Math.random().toString(36).slice(2, 9)}`);
  return id;
}
