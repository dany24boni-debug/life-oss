import { Skeleton, SkeletonText } from "@/ui";

// Boundary di caricamento del gruppo (app): scheletro con la stessa forma
// di Oggi (header + card), shimmer che rispetta prefers-reduced-motion via
// i token Ember. I blocchi sono decorativi: annuncia il contenitore.

export default function AppShellLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <div className="pt-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-8 w-56" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="em-card flex flex-col gap-3 p-5">
          <Skeleton className="h-3.5 w-24" />
          <SkeletonText lines={2} />
        </div>
      ))}
    </div>
  );
}
