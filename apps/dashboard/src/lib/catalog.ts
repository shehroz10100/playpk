import {
  orderSportsForRail,
  resolveSportCover,
  type SportDto,
  type VenueListItem,
} from '@playpk/shared-types';
import { getApiBase } from './api-base';
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

type ApiSuccess<T> = { success: true; data: T };

async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${getApiBase()}${path}`, {
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

  const rows = data as Array<{
    id: string;
    name: string;
    iconUrl: string | null;
    createdAt?: string;
  }>;

  return orderSportsForRail(rows).map((s) => ({
    id: s.id,
    name: s.name,
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
  operatingHoursStart?: string;
  operatingHoursEnd?: string;
  Company: { id: string; name: string; logoUrl: string | null };
  Court: Array<{
    id?: string;
    name?: string;
    capacity?: number;
    pricePerHour: number | string;
    indoor?: boolean;
    hasAC?: boolean;
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

export type CatalogVenueDetail = {
  id: string;
  name: string;
  city: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  operatingHoursStart: string;
  operatingHoursEnd: string;
  avgRating?: number | null;
  photos?: string[];
  sports?: Array<{ id?: string; name: string; iconUrl?: string | null }>;
  company: { name: string; description?: string | null };
  courts: Array<{
    id: string;
    name: string;
    pricePerHour: number;
    indoor: boolean;
    hasAC: boolean;
    photos?: string[];
    sport: { id?: string; name: string; iconUrl?: string | null };
  }>;
};

export async function fetchVenueDetail(branchId: string): Promise<CatalogVenueDetail | null> {
  const fromApi = await apiGet<CatalogVenueDetail>(`/api/venues/${branchId}`);
  if (fromApi) return fromApi;

  const supabase = getSupabaseBrowser();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('Branch')
    .select(
      'id, name, city, address, latitude, longitude, operatingHoursStart, operatingHoursEnd, approvalStatus, Company!inner(id, name, logoUrl, approvalStatus), Court(id, name, capacity, pricePerHour, indoor, hasAC, photos, Sport(id, name, iconUrl))',
    )
    .eq('id', branchId)
    .eq('approvalStatus', 'APPROVED')
    .eq('Company.approvalStatus', 'APPROVED')
    .maybeSingle();

  if (error || !data) return null;

  const branch = data as unknown as SbBranch;
  const courts = (branch.Court ?? [])
    .filter((c): c is typeof c & { id: string; name: string } => Boolean(c.id && c.name))
    .map((c) => ({
      id: c.id,
      name: c.name,
      pricePerHour: Number(c.pricePerHour),
      indoor: Boolean(c.indoor),
      hasAC: Boolean(c.hasAC),
      photos: c.photos ?? undefined,
      sport: { id: c.Sport.id, name: c.Sport.name, iconUrl: c.Sport.iconUrl },
    }));

  return {
    id: branch.id,
    name: branch.name,
    city: branch.city,
    address: branch.address,
    latitude: branch.latitude ?? null,
    longitude: branch.longitude ?? null,
    operatingHoursStart: branch.operatingHoursStart ?? '06:00',
    operatingHoursEnd: branch.operatingHoursEnd ?? '23:00',
    company: { name: branch.Company.name },
    sports: [
      ...new Map(courts.map((c) => [c.sport.id ?? c.sport.name, c.sport])).values(),
    ],
    courts,
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
