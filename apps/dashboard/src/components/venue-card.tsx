'use client';

import Link from 'next/link';
import { MapPin, Star } from 'lucide-react';
import type { VenueListItem } from '@playpk/shared-types';
import { HoverLoopMedia } from '@/components/media/hover-loop-media';
import { MotionPress, MotionReveal } from '@/components/motion/motion-reveal';
import { resolveVenuePreviewClip } from '@/lib/media-assets';
import { googleMapsUrl } from '@/lib/google-maps';
import { cn, formatPkr } from '@/lib/utils';
import { resolveVenueCover } from '@/lib/venue-cover';

type Props = {
  venue: VenueListItem;
  index?: number;
  /** Shorter card for mobile snap rails. */
  compact?: boolean;
};

export function VenueCard({ venue, index = 0, compact = false }: Props) {
  const cover = resolveVenueCover(venue);
  const preview = resolveVenuePreviewClip(cover);
  const rating = venue.avgRating;

  return (
    <MotionReveal index={index} className="h-full">
      <MotionPress className="h-full">
        <Link
          href={`/venues/${venue.id}`}
          className={cn(
            'group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl bg-white shadow-panel transition duration-200 hover:shadow-[0_12px_28px_rgba(11,31,58,0.12)]',
            compact ? 'min-h-[340px]' : 'min-h-[400px] sm:min-h-[420px]',
          )}
        >
          <HoverLoopMedia
            clip={preview}
            priority={index < 2}
            sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
            className={cn('shrink-0', compact ? 'aspect-[16/10] min-h-[160px]' : 'aspect-[16/10] min-h-[200px]')}
          >
            <div className="absolute inset-0 z-[1] bg-gradient-to-t from-navy/70 via-navy/10 to-transparent" />
            <div className="absolute left-3 top-3 z-[2] flex flex-wrap gap-1.5">
              {venue.discountPercent != null && venue.discountPercent > 0 ? (
                <span className="rounded-md bg-brand px-2 py-1 text-[11px] font-bold text-white shadow-sm">
                  {venue.discountPercent}% OFF
                </span>
              ) : null}
              {rating != null ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-[11px] font-bold text-navy backdrop-blur">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {rating.toFixed(1)}
                </span>
              ) : (
                <span className="rounded-md bg-navy/80 px-2 py-1 text-[11px] font-bold text-white backdrop-blur">
                  New
                </span>
              )}
            </div>
            <div className="absolute bottom-3 left-3 right-3 z-[2]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-100">
                {venue.company.name}
              </p>
              <h3
                className={cn(
                  'mt-0.5 line-clamp-2 font-bold leading-tight text-white drop-shadow',
                  compact ? 'text-base sm:text-lg' : 'text-lg sm:text-xl',
                )}
              >
                {venue.name}
              </h3>
            </div>
          </HoverLoopMedia>

          <div className={cn('flex min-h-0 flex-1 flex-col gap-2.5', compact ? 'p-3.5' : 'gap-3 p-4')}>
            <p className="flex min-h-[2.25rem] items-start gap-1.5 text-sm">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
              <span
                role="link"
                tabIndex={0}
                className="line-clamp-2 cursor-pointer font-medium text-brand underline-offset-2 hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(
                    googleMapsUrl({ address: venue.address, city: venue.city }),
                    '_blank',
                    'noopener,noreferrer',
                  );
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(
                      googleMapsUrl({ address: venue.address, city: venue.city }),
                      '_blank',
                      'noopener,noreferrer',
                    );
                  }
                }}
              >
                {venue.address}
                {venue.city ? `, ${venue.city}` : ''}
              </span>
            </p>

            <div className="flex min-h-[2.75rem] flex-wrap content-start items-start gap-2">
              <span className="rounded-md bg-brand/10 px-2 py-1 text-xs font-bold text-brand-700">
                {venue.minPrice != null ? `from ${formatPkr(venue.minPrice)}` : 'Check prices'}
                {venue.discountPercent ? ' · deal' : ''}
              </span>
              <span className="rounded-md bg-navy/5 px-2 py-1 text-xs font-semibold text-navy/70">
                {venue.courtCount} courts
              </span>
              {venue.sports.slice(0, compact ? 1 : 2).map((s) => {
                const deal = venue.sportDiscounts?.find((d) => d.sportId === s.id);
                return (
                  <span
                    key={s.id}
                    className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-navy/65"
                  >
                    {s.name}
                    {deal ? ` · ${deal.percentOff}% off` : ''}
                  </span>
                );
              })}
            </div>

            <span className="mt-auto inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand text-sm font-bold text-white transition group-hover:bg-brand-600">
              View courts
            </span>
          </div>
        </Link>
      </MotionPress>
    </MotionReveal>
  );
}
