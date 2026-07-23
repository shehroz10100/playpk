'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Clock, MapPin, Star } from 'lucide-react';
import { resolveSportCover } from '@playpk/shared-types';
import { HeroMedia } from '@/components/media/hero-media';
import { HoverLoopMedia } from '@/components/media/hover-loop-media';
import { MotionPress, MotionReveal } from '@/components/motion/motion-reveal';
import { StadiumSkeleton } from '@/components/motion/stadium-skeleton';
import { Button } from '@/components/ui/button';
import { fetchVenueDetail, type CatalogVenueDetail } from '@/lib/catalog';
import { resolveVenuePreviewClip } from '@/lib/media-assets';
import { googleMapsUrl } from '@/lib/google-maps';
import { formatPkr, cn } from '@/lib/utils';
import { mediaUrl, resolveVenueCover } from '@/lib/venue-cover';

export default function VenueDetailPage() {
  const params = useParams<{ id: string }>();
  const [venue, setVenue] = useState<CatalogVenueDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

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

  const gallery = useMemo(() => {
    if (!venue) return [] as string[];
    const fromVenue =
      venue.photos?.map((p) => mediaUrl(p)).filter((p): p is string => Boolean(p)) ?? [];
    const fromCourts = venue.courts
      .flatMap((c) => c.photos ?? [])
      .map((p) => mediaUrl(p))
      .filter((p): p is string => Boolean(p));
    const unique = [...new Set([...fromVenue, ...fromCourts])];
    if (unique.length === 0) return [resolveVenueCover(venue)];
    return unique.slice(0, 8);
  }, [venue]);

  const sportNames = useMemo(() => {
    if (!venue) return [] as string[];
    return [...new Set(venue.courts.map((c) => c.sport.name))];
  }, [venue]);

  const minPrice = useMemo(() => {
    if (!venue?.courts.length) return null;
    return Math.min(...venue.courts.map((c) => c.pricePerHour));
  }, [venue]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!venue) {
    return <StadiumSkeleton className="mt-2" lines={4} />;
  }

  const cover = resolveVenueCover(venue);
  const tour = resolveVenuePreviewClip(cover);
  const firstCourt = venue.courts[0];

  return (
    <div className="space-y-6 pb-28 sm:pb-8">
      {/* Tour hero — one muted loop + navy scrim */}
      <section className="-mx-4 overflow-hidden sm:-mx-6 sm:rounded-3xl animate-fade-in">
        <HeroMedia
          clip={tour}
          autoPlay
          className="sm:rounded-3xl"
          minClassName="aspect-[16/9] min-h-[240px] sm:min-h-[300px]"
        >
          <div className="flex min-h-[240px] flex-col justify-end gap-4 p-5 sm:min-h-[300px] sm:p-8">
            <div>
              <Link
                href="/discover"
                className="mb-3 inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-white/80 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to discover
              </Link>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">
                {venue.company.name}
              </p>
              <h1 className="font-display mt-1 text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl">
                {venue.name}
              </h1>
              <div className="mt-3 flex flex-col gap-2 text-sm text-white/80">
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  <a
                    href={googleMapsUrl({
                      address: venue.address,
                      city: venue.city,
                      latitude: venue.latitude,
                      longitude: venue.longitude,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-start gap-1.5 font-medium text-brand-100 underline decoration-brand/60 underline-offset-2 transition hover:text-white hover:decoration-white"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    <span>
                      {venue.address}, {venue.city}
                    </span>
                  </a>
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
                <a
                  href={googleMapsUrl({
                    address: venue.address,
                    city: venue.city,
                    latitude: venue.latitude,
                    longitude: venue.longitude,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand underline decoration-brand/50 underline-offset-4 transition hover:text-brand-100 hover:decoration-brand-100"
                >
                  Open in Google Maps
                </a>
              </div>
            </div>

            {firstCourt ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  className="h-11 rounded-xl bg-brand font-bold text-white hover:bg-brand-600"
                  onClick={() => {
                    document.getElementById('venue-courts')?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    });
                  }}
                >
                  Book a court
                </Button>
                <p className="text-sm text-white/70">
                  {venue.courts.length} court{venue.courts.length === 1 ? '' : 's'}
                  {minPrice != null ? ` · from ${formatPkr(minPrice)}/hr` : ''}
                </p>
              </div>
            ) : null}
          </div>
        </HeroMedia>
      </section>

      {/* Quick facts — flat, no shader */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          { label: 'Courts', value: String(venue.courts.length) },
          { label: 'From', value: minPrice != null ? formatPkr(minPrice) : '—' },
          { label: 'Sports', value: String(sportNames.length || '—') },
          {
            label: 'Hours',
            value: `${venue.operatingHoursStart.slice(0, 5)}–${venue.operatingHoursEnd.slice(0, 5)}`,
          },
        ].map((fact) => (
          <div key={fact.label} className="rounded-2xl bg-white px-3 py-3 shadow-panel sm:px-4">
            <p className="font-display text-lg font-bold uppercase tracking-tight text-navy sm:text-xl">
              {fact.value}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {fact.label}
            </p>
          </div>
        ))}
      </section>

      {sportNames.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {sportNames.map((name) => (
            <span
              key={name}
              className="rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand-700"
            >
              {name}
            </span>
          ))}
        </div>
      ) : null}

      {/* Static gallery (hero already owns the tour loop) */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-bold uppercase tracking-tight text-navy">
            Gallery
          </h2>
          <p className="text-xs font-semibold text-muted-foreground">
            {galleryIndex + 1} / {gallery.length}
          </p>
        </div>
        <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-navy/10 shadow-panel">
          <Image
            src={gallery[galleryIndex] ?? cover}
            alt=""
            fill
            sizes="(max-width:768px) 100vw, 900px"
            className="object-cover"
            priority={galleryIndex === 0}
          />
        </div>
        {gallery.length > 1 ? (
          <div className="sport-rail flex gap-2 overflow-x-auto pb-1">
            {gallery.map((src, i) => (
              <button
                key={`${src}-${i}`}
                type="button"
                onClick={() => setGalleryIndex(i)}
                className={cn(
                  'relative h-16 w-24 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 transition duration-200',
                  i === galleryIndex
                    ? 'border-accent opacity-100'
                    : 'border-transparent opacity-75 hover:opacity-100',
                )}
                aria-label={`Gallery photo ${i + 1}`}
                aria-current={i === galleryIndex}
              >
                <Image src={src} alt="" fill sizes="96px" className="object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {/* Courts → booking calendar on court page */}
      <section id="venue-courts" className="scroll-mt-24 space-y-4">
        <div>
          <h2 className="font-display text-xl font-bold uppercase tracking-tight text-navy">
            Courts &amp; booking
          </h2>
          <p className="text-sm text-muted-foreground">
            Pick a court to open the date and slot calendar.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {venue.courts.map((court, i) => {
            const courtPhoto =
              mediaUrl(court.photos?.[0]) ??
              resolveSportCover(court.sport.name, court.sport.iconUrl);
            return (
              <MotionReveal key={court.id} index={i}>
                <MotionPress>
                  <Link
                    href={`/courts/${court.id}`}
                    className="group block cursor-pointer overflow-hidden rounded-2xl bg-white shadow-panel"
                  >
                    <HoverLoopMedia
                      clip={resolveVenuePreviewClip(courtPhoto)}
                      hoverPlay
                      sizes="(max-width:640px) 100vw, 50vw"
                      className="aspect-[16/9]"
                    >
                      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-navy/80 via-navy/20 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3 z-[2]">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-100">
                          {court.sport.name}
                        </p>
                        <h3 className="font-display text-lg font-bold uppercase tracking-tight text-white">
                          {court.name}
                        </h3>
                      </div>
                    </HoverLoopMedia>
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
                      <span className="rounded-xl bg-brand px-3 py-2 text-xs font-bold text-white transition group-hover:bg-brand-600">
                        Book slots
                      </span>
                    </div>
                  </Link>
                </MotionPress>
              </MotionReveal>
            );
          })}
        </div>
        {venue.courts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-navy/15 bg-white/70 px-4 py-6 text-sm text-muted-foreground">
            No courts listed for this venue yet.
          </p>
        ) : null}
      </section>

      {/* Mobile sticky CTA */}
      {firstCourt ? (
        <div className="fixed inset-x-0 bottom-[5.25rem] z-40 border-t border-border bg-white/95 p-3 shadow-[0_-8px_24px_rgba(11,31,58,0.08)] backdrop-blur sm:hidden">
          <Link
            href={`/courts/${firstCourt.id}`}
            className="flex h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-brand text-sm font-bold text-white transition hover:bg-brand-600"
          >
            Book from {minPrice != null ? formatPkr(minPrice) : '…'}/hr
          </Link>
        </div>
      ) : null}
    </div>
  );
}
