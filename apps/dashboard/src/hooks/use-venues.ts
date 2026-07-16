'use client';

import { useQuery } from '@tanstack/react-query';
import type { SportDto, VenueListItem } from '@playpk/shared-types';
import {
  DEFAULT_VENUE_FILTERS,
  fetchSportsCatalog,
  fetchVenuesCatalog,
  type VenueFilters,
} from '@/lib/catalog';

export type { VenueFilters };
export { DEFAULT_VENUE_FILTERS };

export function buildVenueQuery(filters: VenueFilters) {
  const query = new URLSearchParams({ pageSize: '30' });
  if (filters.city.trim()) query.set('city', filters.city.trim());
  if (filters.sport) query.set('sport', filters.sport);
  const minPrice = Number(filters.minPrice);
  const maxPrice = Number(filters.maxPrice);
  const minRating = Number(filters.minRating);
  if (filters.minPrice.trim() && Number.isFinite(minPrice) && minPrice >= 0) {
    query.set('minPrice', String(minPrice));
  }
  if (filters.maxPrice.trim() && Number.isFinite(maxPrice) && maxPrice >= 0) {
    query.set('maxPrice', String(maxPrice));
  }
  if (
    filters.minRating.trim() &&
    Number.isFinite(minRating) &&
    minRating >= 1 &&
    minRating <= 5
  ) {
    query.set('minRating', String(minRating));
  }
  return query.toString();
}

export function useSports(initialData?: SportDto[]) {
  return useQuery({
    queryKey: ['sports'],
    queryFn: fetchSportsCatalog,
    initialData,
    initialDataUpdatedAt: initialData?.length ? Date.now() : 0,
    staleTime: 60 * 60_000,
    placeholderData: (prev) => prev ?? initialData,
  });
}

export function useVenues(
  filters: VenueFilters,
  options?: { initialData?: VenueListItem[] },
) {
  const qs = buildVenueQuery(filters);
  const isDefault = qs === buildVenueQuery(DEFAULT_VENUE_FILTERS);
  const initialData = isDefault ? options?.initialData : undefined;

  return useQuery({
    queryKey: ['venues', qs],
    queryFn: () => fetchVenuesCatalog(filters),
    initialData,
    initialDataUpdatedAt: initialData?.length ? Date.now() : 0,
    staleTime: 30_000,
    placeholderData: (prev) => prev ?? initialData,
  });
}
