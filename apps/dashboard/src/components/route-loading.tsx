export function RouteLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 py-16">
      <div className="font-display text-lg font-bold text-navy animate-pulse">
        Play<span className="text-brand">PK</span>
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-navy/10">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-brand/70" />
      </div>
    </div>
  );
}
