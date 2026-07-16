import {
  orderSportsForRail,
  resolveSportCover,
  type SportDto,
  type VenueListItem,
} from '@playpk/shared-types';
import { getSupabaseBrowser } from './supabase';

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

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

type ApiSuccess<T> = { success: true; data: T };

async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ApiSuccess<T>;
    if (!json.success) return null;
    return json.data;
  } catch {
    return null;
  }
}

export async function fetchSportsCatalog(): Promise<SportDto[]> {
  const fromApi = await apiGet<SportDto[]>('/api/sports');
  if (fromApi && fromApi.length > 0) return fromApi;

  const supabase = getSupabaseBrowser();
  if (!supabase) return fromApi ?? [];

  const { data, error } = await supabase.from('Sport').select('id, name, iconUrl, createdAt');
  if (error || !data) return [];

  return orderSportsForRail(data).map((s) => ({
    ...s,
    iconUrl: resolveSportCover(s.name, s.iconUrl),
  }));
}

type SbBranch = {
  id: string;
  name: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  Company: { id: string; name: string; logoUrl: string | null };
  Court: Array<{
    pricePerHour: number | string;
    photos: string[] | null;
    Sport: { id: string; name: string; iconUrl: string | null };
  }>;
};

function mapBranch(branch: SbBranch): VenueListItem {
  const courts = branch.Court ?? [];
  const prices = courts.map((c) => Number(c.pricePerHour));
  const sports = [
    ...new Map(courts.map((c) => [c.Sport.id, c.Sport])).values(),
  ].map((s) => ({
    id: s.id,
    name: s.name,
    iconUrl: resolveSportCover(s.name, s.iconUrl),
  }));
  const photos = [...new Set(courts.flatMap((c) => c.photos ?? []))].slice(0, 6);

  return {
    id: branch.id,
    name: branch.name,
    city: branch.city,
    address: branch.address,
    latitude: branch.latitude,
    longitude: branch.longitude,
    company: {
      id: branch.Company.id,
      name: branch.Company.name,
      logoUrl: branch.Company.logoUrl,
    },
    avgRating: null,
    reviewCount: 0,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    sports,
    photos,
    courtCount: courts.length,
  };
}

export async function fetchVenuesCatalog(filters: VenueFilters): Promise<VenueListItem[]> {
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

  const fromApi = await apiGet<VenueListItem[]>(`/api/venues?${query.toString()}`);
  if (fromApi && fromApi.length > 0) return fromApi;

  const supabase = getSupabaseBrowser();
  if (!supabase) return fromApi ?? [];

  let q = supabase
    .from('Branch')
    .select(
      'id, name, city, address, latitude, longitude, approvalStatus, Company!inner(id, name, logoUrl, approvalStatus), Court(pricePerHour, photos, Sport(id, name, iconUrl))',
    )
    .eq('approvalStatus', 'APPROVED')
    .eq('Company.approvalStatus', 'APPROVED')
    .order('name')
    .limit(30);

  if (filters.city.trim()) {
    q = q.ilike('city', filters.city.trim());
  }

  const { data, error } = await q;
  if (error || !data) return [];

  let venues = (data as unknown as SbBranch[]).map(mapBranch);

  if (filters.sport) {
    const sport = filters.sport.toLowerCase();
    venues = venues.filter((v) => v.sports.some((s) => s.name.toLowerCase() === sport));
  }
  if (filters.minPrice.trim() && Number.isFinite(minPrice)) {
    venues = venues.filter((v) => v.minPrice != null && v.minPrice >= minPrice);
  }
  if (filters.maxPrice.trim() && Number.isFinite(maxPrice)) {
    venues = venues.filter((v) => v.minPrice != null && v.minPrice <= maxPrice);
  }

  return venues;
}
