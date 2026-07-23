import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

/** Shared empty / no-results pattern for the player app. */
export function PlayerEmptyState({
  icon: Icon = MapPin,
  title,
  description,
  actionHref,
  actionLabel,
  onAction,
  className,
}: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy/15 bg-white px-5 py-10 text-center shadow-panel',
        className,
      )}
    >
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <p className="font-display text-base font-bold uppercase tracking-tight text-navy">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-5 inline-flex h-11 min-w-[10rem] cursor-pointer items-center justify-center rounded-xl bg-brand px-5 text-sm font-bold text-white transition hover:bg-brand-600"
        >
          {actionLabel}
        </Link>
      ) : null}
      {onAction && actionLabel && !actionHref ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex h-11 min-w-[10rem] cursor-pointer items-center justify-center rounded-xl bg-brand px-5 text-sm font-bold text-white transition hover:bg-brand-600"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
