'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Clock, MapPin, Star } from 'lucide-react';
import { resolveSportCover } from '@playpk/shared-types';
import { fetchVenueDetail, type CatalogVenueDetail } from '@/lib/catalog';
import { formatPkr } from '@/lib/utils';
import { mediaUrl, resolveVenueCover } from '@/lib/venue-cover';

export default function VenueDetailPage() {
  const params = useParams<{ id: string }>();
  const [venue, setVenue] = useState<CatalogVenueDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchVenueDetail(params.id)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setError('Venue not found');
          return;
        }
        setVenue(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!venue) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-56 rounded-3xl bg-navy/10" />
        <div className="h-6 w-48 rounded bg-navy/10" />
      </div>
    );
  }

  const cover = resolveVenueCover(venue);

  return (
    <div className="space-y-6">
      <section className="relative -mx-4 overflow-hidden sm:-mx-6 sm:rounded-3xl animate-fade-in">
        <div className="relative aspect-[16/9] min-h-[220px] sm:min-h-[280px]">
          <Image src={cover} alt="" fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/50 to-navy/20" />
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
            <Link
              href="/discover"
              className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-white/80 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">{venue.company.name}</p>
            <h1 className="font-display mt-1 text-3xl font-extrabold text-white sm:text-4xl">
              {venue.name}
            </h1>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-white/80">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-brand" />
                {venue.address}, {venue.city}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-brand" />
                {venue.operatingHoursStart}–{venue.operatingHoursEnd}
              </span>
              {venue.avgRating != null ? (
                <span className="inline-flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {venue.avgRating.toFixed(1)}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-navy">Courts</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {venue.courts.map((court, i) => {
            const courtPhoto =
              mediaUrl(court.photos?.[0]) ?? resolveSportCover(court.sport.name, court.sport.iconUrl);
            return (
              <Link
                key={court.id}
                href={`/courts/${court.id}`}
                className="group overflow-hidden rounded-2xl bg-white shadow-panel transition hover:-translate-y-0.5 animate-rise"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="relative aspect-[16/9] overflow-hidden">
                  <Image
                    src={courtPhoto}
                    alt=""
                    fill
                    sizes="(max-width:640px) 100vw, 50vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy/75 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-100">
                      {court.sport.name}
                    </p>
                    <h3 className="text-lg font-bold text-white">{court.name}</h3>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-md bg-brand/10 px-2 py-1 text-xs font-bold text-brand-700">
                      {formatPkr(court.pricePerHour)}/hr
                    </span>
                    <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-navy/65">
                      {court.indoor ? 'Indoor' : 'Outdoor'}
                    </span>
                    {court.hasAC ? (
                      <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-navy/65">
                        AC
                      </span>
                    ) : null}
                  </div>
                  <span className="rounded-xl bg-navy px-3 py-2 text-xs font-bold text-white transition group-hover:bg-brand">
                    Book
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
