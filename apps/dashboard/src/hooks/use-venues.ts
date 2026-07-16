'use client';

import { useQuery } from '@tanstack/react-query';
import type { SportDto, VenueListItem } from '@playpk/shared-types';
import { api } from '@/lib/api';

export type VenueFilters = {
  city: string;
  sport: string;
  minPrice: string;
  maxPrice: string;
  minRating: string;
};

export const DEFAULT_VENUE_FILTERS: VenueFilters = {
  city: 'Lahore',
  sport: '',
  minPrice: '',
  maxPrice: '',
  minRating: '',
};

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
    queryFn: async () => {
      const { data } = await api<SportDto[]>('/api/sports', { auth: false });
      return data;
    },
    initialData,
    staleTime: 60 * 60_000,
  });
}

export function useVenues(
  filters: VenueFilters,
  options?: { initialData?: VenueListItem[] },
) {
  const qs = buildVenueQuery(filters);
  return useQuery({
    queryKey: ['venues', qs],
    queryFn: async () => {
      const { data } = await api<VenueListItem[]>(`/api/venues?${qs}`, { auth: false });
      return data;
    },
    initialData:
      qs === buildVenueQuery(DEFAULT_VENUE_FILTERS) ? options?.initialData : undefined,
    staleTime: 30_000,
  });
}
