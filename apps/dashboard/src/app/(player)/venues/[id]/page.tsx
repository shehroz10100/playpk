'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { fetchVenueDetail, type CatalogVenueDetail } from '@/lib/catalog';
import { formatPkr } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
  if (!venue) return <p className="text-sm text-muted-foreground">Loading venue…</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/discover" className="text-sm font-medium text-brand hover:underline">
          ← Back to discover
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-navy sm:text-3xl">{venue.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {venue.company.name} · {venue.address}, {venue.city}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Hours {venue.operatingHoursStart}–{venue.operatingHoursEnd}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {venue.courts.map((court) => (
          <Card key={court.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{court.name}</CardTitle>
              <CardDescription>
                {court.sport.name} · from {formatPkr(court.pricePerHour)}/hr
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <Badge variant={court.indoor ? 'success' : 'muted'}>
                  {court.indoor ? 'Indoor' : 'Outdoor'}
                </Badge>
                <Badge variant="muted">{court.hasAC ? 'AC' : 'No AC'}</Badge>
              </div>
              <Link
                href={`/courts/${court.id}`}
                className="inline-flex h-9 items-center rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-brand-600"
              >
                Book slots
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
