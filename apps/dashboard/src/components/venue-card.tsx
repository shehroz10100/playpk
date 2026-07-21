'use client';

import Link from 'next/link';
import { MapPin, Star } from 'lucide-react';
import type { VenueListItem } from '@playpk/shared-types';
import { HoverLoopMedia } from '@/components/media/hover-loop-media';
import { MotionPress, MotionReveal } from '@/components/motion/motion-reveal';
import { resolveVenuePreviewClip } from '@/lib/media-assets';
import { formatPkr } from '@/lib/utils';
import { resolveVenueCover } from '@/lib/venue-cover';

type Props = {
  venue: VenueListItem;
  index?: number;
};

export function VenueCard({ venue, index = 0 }: Props) {
  const cover = resolveVenueCover(venue);
  const preview = resolveVenuePreviewClip(cover);
  const rating = venue.avgRating;

  return (
    <MotionReveal index={index} className="h-full">
      <MotionPress className="h-full">
        <Link
          href={`/venues/${venue.id}`}
          className="group relative flex h-full min-h-[420px] cursor-pointer flex-col overflow-hidden rounded-2xl bg-white shadow-panel transition duration-200 hover:shadow-[0_12px_28px_rgba(11,31,58,0.12)]"
        >
          <HoverLoopMedia
            clip={preview}
            hoverPlay
            sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
            className="aspect-[16/10] shrink-0"
          >
            <div className="absolute inset-0 z-[1] bg-gradient-to-t from-navy/70 via-navy/10 to-transparent" />
            <div className="absolute left-3 top-3 z-[2] flex flex-wrap gap-1.5">
              {rating != null ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-[11px] font-bold text-navy backdrop-blur">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {rating.toFixed(1)}
                </span>
              ) : (
                <span className="rounded-md bg-brand px-2 py-1 text-[11px] font-bold text-white">
                  New
                </span>
              )}
            </div>
            <div className="absolute bottom-3 left-3 right-3 z-[2]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-100">
                {venue.company.name}
              </p>
              <h3 className="mt-0.5 line-clamp-2 text-lg font-bold leading-tight text-white drop-shadow sm:text-xl">
                {venue.name}
              </h3>
            </div>
          </HoverLoopMedia>

          <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
            <p className="flex min-h-[2.5rem] items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
              <span className="line-clamp-2">{venue.address}</span>
            </p>

            <div className="flex min-h-[3.25rem] flex-wrap content-start items-start gap-2">
              <span className="rounded-md bg-brand/10 px-2 py-1 text-xs font-bold text-brand-700">
                {venue.minPrice != null ? `from ${formatPkr(venue.minPrice)}` : 'Check prices'}
              </span>
              <span className="rounded-md bg-navy/5 px-2 py-1 text-xs font-semibold text-navy/70">
                {venue.courtCount} courts
              </span>
              {venue.sports.slice(0, 2).map((s) => (
                <span
                  key={s.id}
                  className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-navy/65"
                >
                  {s.name}
                </span>
              ))}
            </div>

            <span className="mt-auto inline-flex h-10 w-full items-center justify-center rounded-xl bg-navy text-sm font-semibold text-white transition group-hover:bg-brand">
              View courts
            </span>
          </div>
        </Link>
      </MotionPress>
    </MotionReveal>
  );
}
