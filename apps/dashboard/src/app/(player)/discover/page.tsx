import type { SportDto, VenueListItem } from '@playpk/shared-types';
import { serverFetch } from '@/lib/server-api';
import { DiscoverClient } from './discover-client';

export default async function DiscoverPage() {
  let initialVenues: VenueListItem[] = [];
  let initialSports: SportDto[] = [];

  try {
    const [venuesRes, sportsRes] = await Promise.all([
      serverFetch<VenueListItem[]>('/api/venues?city=Lahore&pageSize=30'),
      serverFetch<SportDto[]>('/api/sports'),
    ]);
    initialVenues = venuesRes.data;
    initialSports = sportsRes.data;
  } catch {
    /* client will refetch if server fetch fails */
  }

  return <DiscoverClient initialVenues={initialVenues} initialSports={initialSports} />;
}
