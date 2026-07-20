'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Star } from 'lucide-react';
import type { VenueListItem } from '@playpk/shared-types';
import { formatPkr } from '@/lib/utils';
import { resolveVenueCover } from '@/lib/venue-cover';

type Props = {
  venue: VenueListItem;
  index?: number;
};

export function VenueCard({ venue, index = 0 }: Props) {
  const cover = resolveVenueCover(venue);
  const rating = venue.avgRating;

  return (
    <Link
      href={`/venues/${venue.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-panel transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(11,31,58,0.12)] animate-rise"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-navy/10">
        <Image
          src={cover}
          alt=""
          fill
          sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
          className="object-cover transition duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/70 via-navy/10 to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
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
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-100">
            {venue.company.name}
          </p>
          <h3 className="mt-0.5 text-lg font-bold leading-tight text-white drop-shadow sm:text-xl">
            {venue.name}
          </h3>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
          <span className="line-clamp-2">{venue.address}</span>
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-brand/10 px-2 py-1 text-xs font-bold text-brand-700">
            {venue.minPrice != null ? `from ${formatPkr(venue.minPrice)}` : 'Check prices'}
          </span>
          <span className="rounded-md bg-navy/5 px-2 py-1 text-xs font-semibold text-navy/70">
            {venue.courtCount} courts
          </span>
          {venue.sports.slice(0, 3).map((s) => (
            <span
              key={s.id}
              className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-navy/65"
            >
              {s.name}
            </span>
          ))}
        </div>

        <span className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-navy text-sm font-semibold text-white transition group-hover:bg-brand">
          View courts
        </span>
      </div>
    </Link>
  );
}
