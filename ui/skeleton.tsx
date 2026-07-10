"use client";

// Skeleton — shimmer block; compose into shapes with width/height classes.
// aria-hidden: skeletons are decorative, the container should announce
// loading via aria-busy.

import { cx } from "./cx";

export function Skeleton({
  className,
  circle = false,
}: {
  className?: string;
  circle?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "em-skeleton block",
        circle && "rounded-full",
        className,
      )}
    />
  );
}

/** Ready-made text-block skeleton: n lines with a shorter last line. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <span className={cx("flex flex-col gap-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cx("h-4", i === lines - 1 ? "w-3/5" : "w-full")}
        />
      ))}
    </span>
  );
}
