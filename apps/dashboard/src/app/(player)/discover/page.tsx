import type { SportDto, VenueListItem } from '@playpk/shared-types';
import { fetchSportsCatalog, fetchVenuesCatalog } from '@/lib/catalog';
import { DiscoverClient } from './discover-client';

export default async function DiscoverPage() {
  let initialVenues: VenueListItem[] = [];
  let initialSports: SportDto[] = [];

  try {
    const [venues, sports] = await Promise.all([
      fetchVenuesCatalog({
        city: 'Lahore',
        sport: '',
        minPrice: '',
        maxPrice: '',
        minRating: '',
      }),
      fetchSportsCatalog(),
    ]);
    initialVenues = venues;
    initialSports = sports;
  } catch {
    /* client will refetch if server fetch fails */
  }

  return <DiscoverClient initialVenues={initialVenues} initialSports={initialSports} />;
}
