// Global loading fallback used by Next during route transitions. Renders
// shimmer placeholders that match the new dashboard skeleton — header avatar
// + state pill, hero ring placeholder, stat grid, list rows. Aria-hidden;
// the route name is read by the browser tab title.

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-6 pt-7" aria-hidden="true">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <Box className="h-10 w-10 rounded-full" />
        <div className="space-y-1.5">
          <Box className="h-4 w-24" />
          <Box className="h-3 w-32" />
        </div>
      </div>

      {/* Action chip row */}
      <div className="mt-5 flex flex-wrap gap-2">
        <Box className="h-7 w-24 rounded-full" />
        <Box className="h-7 w-20 rounded-full" />
        <Box className="h-7 w-24 rounded-full" />
      </div>

      {/* Hero ring placeholder */}
      <div className="mt-7 flex items-center justify-center">
        <Box className="h-[240px] w-[240px] rounded-full" />
      </div>

      {/* Stat grid */}
      <div className="mt-7 grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      {/* Section header + rows */}
      <Box className="mt-7 h-3 w-32" />
      <div className="mt-3 space-y-2">
        {[0, 1, 2].map((i) => (
          <Box key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    </main>
  );
}

function Box({ className }: { className: string }) {
  return (
    <div
      className={`bg-surface ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)",
        backgroundSize: "200% 100%",
        animation: "lifeos-shimmer 1.4s ease-in-out infinite",
      }}
    />
  );
}
