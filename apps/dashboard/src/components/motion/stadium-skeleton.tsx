import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  lines?: number;
};

/** Stadium-tinted skeleton (not generic gray). */
export function StadiumSkeleton({ className, lines = 3 }: Props) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-navy/5 bg-gradient-to-br from-[#EEF3F0] via-white to-[#e8f5ee] p-4',
        className,
      )}
      aria-hidden
    >
      <div className="pointer-events-none absolute inset-0 animate-pulse bg-[radial-gradient(600px_200px_at_10%_-20%,rgba(0,166,81,0.12),transparent_55%),radial-gradient(400px_160px_at_100%_0%,rgba(245,158,11,0.08),transparent_50%)]" />
      <div className="relative space-y-3">
        <div className="h-32 rounded-xl bg-navy/8" />
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 rounded-full bg-navy/10"
            style={{ width: `${88 - i * 14}%` }}
          />
        ))}
      </div>
    </div>
  );
}
