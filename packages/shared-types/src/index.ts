/** Shared domain enums & API DTO shapes used by api, mobile, and dashboard. */

/** Flat advance charged at booking time for every sport/court (PKR). */
export const BOOKING_ADVANCE_PKR = 1000;

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum UserRole {
  PLAYER = 'PLAYER',
  COMPANY_OWNER = 'COMPANY_OWNER',
  BRANCH_MANAGER = 'BRANCH_MANAGER',
  ADMIN = 'ADMIN',
}

export enum LoyaltyTier {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  DIAMOND = 'DIAMOND',
}

export enum SlotStatus {
  AVAILABLE = 'AVAILABLE',
  BOOKED = 'BOOKED',
  BLOCKED = 'BLOCKED',
  MAINTENANCE = 'MAINTENANCE',
}

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}

export enum MembershipPlan {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

export enum MembershipStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

export enum TournamentFormat {
  LEAGUE = 'LEAGUE',
  KNOCKOUT = 'KNOCKOUT',
  GROUPS = 'GROUPS',
}

export enum TournamentStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum MatchStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export type PaymentMethod = 'jazzcash' | 'easypaisa' | 'card' | 'mock' | 'wallet';

// ─── API envelope ─────────────────────────────────────────────────────────────

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginatedMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  timestamp: string;
  checks: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole | string;
  loyaltyPoints: number;
  loyaltyTier: LoyaltyTier | string;
  walletBalance: number;
  createdAt?: string | Date;
}

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

// ─── Domain DTOs ──────────────────────────────────────────────────────────────

export interface SportDto {
  id: string;
  name: string;
  iconUrl?: string | null;
}

/** Primary sports rail order (customer + staff UIs). "All" is rendered last by clients. */
export const FEATURED_SPORT_ORDER = [
  'Cricket',
  'Padel',
  'Futsal',
  'Badminton',
  'Snooker',
  'Gym',
] as const;

export type FeaturedSportName = (typeof FEATURED_SPORT_ORDER)[number];

/** Cover images for sport filter cards (verified Unsplash URLs). */
export const SPORT_COVER_IMAGES: Record<string, string> = {
  Cricket:
    'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?auto=format&fit=crop&w=480&h=720&q=80',
  Padel:
    'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=480&h=720&q=80',
  Futsal:
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=480&h=720&q=80',
  Badminton:
    'https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=480&h=720&q=80',
  Snooker:
    'https://images.unsplash.com/photo-1611293388250-580b08c4a145?auto=format&fit=crop&w=480&h=720&q=80',
  Gym: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=480&h=720&q=80',
  All: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=480&h=720&q=80',
  Pickleball:
    'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=480&h=720&q=80',
  Tennis:
    'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=480&h=720&q=80',
  Squash:
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=480&h=720&q=80',
  Basketball:
    'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=480&h=720&q=80',
  Volleyball:
    'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=480&h=720&q=80',
  'Table Tennis':
    'https://images.unsplash.com/photo-1534158914592-062992fbe900?auto=format&fit=crop&w=480&h=720&q=80',
  Swimming:
    'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=480&h=720&q=80',
  Bowling:
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=480&h=720&q=80',
};

export const DEFAULT_SPORT_COVER =
  'https://images.unsplash.com/photo-1471295253337-3ceaaedca402?auto=format&fit=crop&w=480&h=720&q=80';

/** Prefer curated covers so stale DB iconUrls cannot break the rail. */
export function resolveSportCover(name: string, iconUrl?: string | null): string {
  const curated = SPORT_COVER_IMAGES[name];
  if (curated) return curated;
  if (iconUrl && /^https?:\/\//i.test(iconUrl)) return iconUrl;
  return DEFAULT_SPORT_COVER;
}

/** Featured sports first (Cricket → Gym), then remaining A–Z. */
export function orderSportsForRail<T extends { name: string }>(sports: T[]): T[] {
  const rank = new Map(FEATURED_SPORT_ORDER.map((name, i) => [name, i]));
  return [...sports].sort((a, b) => {
    const ai = rank.get(a.name as FeaturedSportName);
    const bi = rank.get(b.name as FeaturedSportName);
    if (ai !== undefined && bi !== undefined) return ai - bi;
    if (ai !== undefined) return -1;
    if (bi !== undefined) return 1;
    return a.name.localeCompare(b.name);
  });
}

/** Only the featured rail chips (missing sports are skipped). */
export function featuredSportsForRail<T extends { name: string }>(sports: T[]): T[] {
  const byName = new Map(sports.map((s) => [s.name, s]));
  return FEATURED_SPORT_ORDER.map((name) => byName.get(name)).filter(
    (s): s is T => s !== undefined,
  );
}

export interface CompanySummary {
  id: string;
  name: string;
  logoUrl?: string | null;
  description?: string | null;
}

export interface BranchSummary {
  id: string;
  name: string;
  city: string;
  address?: string;
  companyId?: string;
}

export interface CourtDto {
  id: string;
  name: string;
  capacity: number;
  pricePerHour: number;
  indoor: boolean;
  hasAC: boolean;
  equipmentAvailable?: string[];
  photos: string[];
  sportId?: string;
  sport: SportDto;
  branchId?: string;
}

export interface VenueListItem {
  id: string;
  name: string;
  city: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  company: CompanySummary;
  avgRating: number | null;
  reviewCount?: number;
  minPrice: number | null;
  maxPrice?: number | null;
  sports: SportDto[];
  photos?: string[];
  courtCount: number;
}

export interface VenueDetail extends VenueListItem {
  operatingHoursStart: string;
  operatingHoursEnd: string;
  reviews?: Array<{
    rating: number;
    comment: string | null;
    createdAt: string | Date;
    user?: { name: string };
  }>;
  courts: CourtDto[];
}

export interface SlotDto {
  id: string;
  date: string | Date;
  startTime: string;
  endTime: string;
  status: SlotStatus | string;
  price: number;
  courtId?: string;
  booking?: { id: string; status: string; userId?: string } | null;
}

export interface CourtAvailabilityResponse {
  court: CourtDto & {
    branch: BranchSummary;
  };
  slots: SlotDto[];
}

export interface BookingDto {
  id: string;
  userId?: string;
  slotId?: string;
  status: BookingStatus | string;
  totalAmount: number;
  paymentStatus: PaymentStatus | string;
  paymentIntentId?: string | null;
  qrCode?: string | null;
  createdAt?: string | Date;
  cancelledAt?: string | Date | null;
  user?: {
    id?: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  slot?: {
    id?: string;
    date: string | Date;
    startTime: string;
    endTime: string;
    price?: number;
    status?: string;
    court?: {
      id?: string;
      name: string;
      branchId?: string;
      sport?: SportDto;
      branch?: BranchSummary;
    };
  };
}

export interface MyBookingsResponse {
  upcoming: BookingDto[];
  past: BookingDto[];
  all: BookingDto[];
}

export interface BranchTodayStats {
  date: string;
  totalSlots: number;
  bookedSlots: number;
  occupancyPercent: number;
  revenue: number;
  currency: string;
}

export interface CompanyDto {
  id: string;
  name: string;
  description: string | null;
  logoUrl?: string | null;
  ownerId?: string;
  createdAt?: string | Date;
  branches: Array<{
    id: string;
    name: string;
    city: string;
    address: string;
    operatingHoursStart?: string;
    operatingHoursEnd?: string;
  }>;
  owner?: { id: string; name: string; email: string | null };
}

// ─── Loyalty / wallet / reviews / waitlist ────────────────────────────────────

export interface LoyaltyStatusDto {
  loyaltyPoints: number;
  loyaltyTier: LoyaltyTier | string;
  currentTier: LoyaltyTier | string;
  nextTier: LoyaltyTier | string | null;
  pointsToNext: number | null;
  thresholds: Record<string, number>;
  recent: Array<{
    id: string;
    points: number;
    reason: string;
    bookingId?: string | null;
    createdAt: string | Date;
  }>;
}

export interface WalletStatusDto {
  walletBalance: number;
  recent: Array<{
    id: string;
    amount: number;
    type: 'TOPUP' | 'DEBIT' | 'REFUND' | string;
    reason: string;
    bookingId?: string | null;
    createdAt: string | Date;
  }>;
}

export interface NotificationDto {
  id: string;
  title: string;
  body: string;
  meta?: Record<string, unknown> | null;
  readAt?: string | Date | null;
  createdAt: string | Date;
}

export interface BranchReviewsDto {
  reviews: Array<{
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string | Date;
    user: { id: string; name: string };
  }>;
  avgRating: number | null;
  reviewCount: number;
}

export interface WaitlistEntryDto {
  id: string;
  createdAt: string | Date;
  user: { id: string; name: string; email: string | null; phone: string | null };
  slot: {
    id: string;
    date: string | Date;
    startTime: string;
    endTime: string;
    court: { id: string; name: string };
  };
}

// ─── AI / analytics / chatbot ─────────────────────────────────────────────────

export interface PricingSuggestionDto {
  slotId: string;
  date: string;
  startTime: string;
  endTime: string;
  currentPrice: number;
  suggestedPrice: number;
  currency: string;
  multipliers: {
    weekend: number;
    holiday: number;
    peak: number;
    demand: number;
  };
  reasons: string[];
  model: string;
}

export interface PricingSuggestResponse {
  court: {
    id: string;
    name: string;
    branchId: string;
    branchName: string;
    sport: string;
    basePrice: number;
  };
  model: string;
  range: { from: string; to: string };
  historicalAvgPaidPrice: number | null;
  historicalBookingCount: number;
  suggestions: PricingSuggestionDto[];
}

export interface AnalyticsDto {
  scope: { branchId: string | null; companyId: string | null };
  window: { from: string; to: string };
  summary: {
    revenue: number;
    currency: string;
    occupancyPercent: number;
    bookedSlots: number;
    totalSlots: number;
    cancellationRate: number;
    uniqueCustomers: number;
    returningCustomers: number;
    topSport: string | null;
    topBranch: { id: string; name: string; bookings: number } | null;
  };
  peakHours: Array<{ hour: string; bookings: number }>;
  revenueByMonth: Array<{ month: string; revenue: number }>;
  forecast: {
    nextMonth: string;
    revenue: number;
    method: string;
    slope: number;
  };
}

export interface ChatbotResponse {
  answer: string;
  intent: {
    sport?: string | null;
    city?: string | null;
    area?: string | null;
    date?: string | null;
    timeFrom?: string | null;
    timeTo?: string | null;
    rawQuestion: string;
    resolvedCity?: string | null;
    matchedBranches?: Array<{
      id: string;
      name: string;
      address: string;
      city: string;
    }>;
  };
  llm: string;
  matchCount: number;
  venues?: Array<{
    id: string;
    name: string;
    address: string;
    city: string;
    sports: string[];
  }>;
  slots: Array<{
    id: string;
    date: string | Date;
    startTime: string;
    endTime: string;
    price: number;
    court: string;
    sport: string;
    branch: string;
    city: string;
    address?: string;
  }>;
}

// ─── Tournaments / teams / leaderboard ────────────────────────────────────────

export interface TournamentDto {
  id: string;
  branchId: string;
  hostUserId?: string | null;
  name: string;
  sportId: string;
  format: TournamentFormat | string;
  status: TournamentStatus | string;
  entryFee: number;
  prizePool: number;
  maxParticipants: number | null;
  description: string | null;
  startDate: string | Date;
  endDate: string | Date;
  createdAt?: string | Date;
  sport?: SportDto;
  branch?: BranchSummary;
  host?: { id: string; name: string } | null;
  isCommunity?: boolean;
  registrationCount?: number;
  matchCount?: number;
}

export interface TournamentRegistrationDto {
  id: string;
  userId: string;
  teamId?: string | null;
  seed?: number | null;
  paymentStatus: PaymentStatus | string;
  paidAmount: number;
  createdAt?: string | Date;
  user: { id: string; name: string; email: string | null; phone: string | null };
  team?: { id: string; name: string } | null;
}

export interface TournamentMatchDto {
  id: string;
  tournamentId: string;
  round: number;
  matchIndex: number;
  homeRegistrationId: string | null;
  awayRegistrationId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerRegistrationId: string | null;
  status: MatchStatus | string;
  scheduledAt?: string | Date | null;
  home: {
    id: string;
    label: string;
    user: { id: string; name: string };
    team: { id: string; name: string } | null;
  } | null;
  away: {
    id: string;
    label: string;
    user: { id: string; name: string };
    team: { id: string; name: string } | null;
  } | null;
  winner?: {
    id: string;
    label: string;
    user: { id: string; name: string };
    team: { id: string; name: string } | null;
  } | null;
}

export interface TournamentDetailDto extends TournamentDto {
  registrations: TournamentRegistrationDto[];
  matches: TournamentMatchDto[];
}

export interface TournamentStandingDto {
  registrationId: string;
  label: string;
  user: { id: string; name: string; email: string | null; phone: string | null };
  team: { id: string; name: string } | null;
  wins: number;
  losses: number;
  played: number;
  points: number;
}

export interface TeamDto {
  id: string;
  name: string;
  sportId: string | null;
  captainId: string;
  createdAt: string | Date;
  sport?: SportDto | null;
  captain?: { id: string; name: string; email: string | null; phone: string | null };
  members: Array<{
    id: string;
    role: string;
    user: { id: string; name: string; email: string | null; phone: string | null };
  }>;
  invites?: Array<{
    id: string;
    email: string | null;
    phone: string | null;
    status: string;
    invitedUserId: string | null;
    createdAt: string | Date;
  }>;
}

export interface LeaderboardEntryDto {
  userId: string;
  name: string;
  wins: number;
  points: number;
  sports: string[];
}

// ─── Social / open matchmaking ───────────────────────────────────────────────

export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'PRO';
export type MatchVisibility = 'PUBLIC' | 'PRIVATE';
export type CasualMatchType = 'COMPETITIVE' | 'FRIENDLY';
export type MatchFormat =
  | 'SINGLES'
  | 'DOUBLES'
  | 'EIGHT_A_SIDE'
  | 'TEN_A_SIDE'
  | 'FOURTEEN_A_SIDE';
export type OpenMatchStatus = 'OPEN' | 'FULL' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface PlayerProfileDto {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  skillLevel: SkillLevel;
  primarySportId: string | null;
  primarySportName: string | null;
  bio: string | null;
  wins: number;
  losses: number;
  points: number;
  matchesPlayed: number;
  onboardingComplete: boolean;
  followersCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
}

export interface OpenMatchPlayerDto {
  id: string;
  userId: string;
  name: string;
  skillLevel: SkillLevel | null;
  status: string;
  side: string | null;
}

export interface OpenMatchDto {
  id: string;
  title: string;
  notes: string | null;
  visibility: MatchVisibility;
  matchType: CasualMatchType;
  format: MatchFormat;
  skillMin: SkillLevel;
  skillMax: SkillLevel;
  status: OpenMatchStatus;
  maxPlayers: number;
  joinedCount: number;
  scheduledAt: string | Date | null;
  city: string | null;
  sport: SportDto;
  host: { id: string; name: string };
  branch: { id: string; name: string; city: string } | null;
  players: OpenMatchPlayerDto[];
  result: {
    homeScore: number;
    awayScore: number;
    winnerSide: string | null;
    notes: string | null;
  } | null;
  createdAt: string | Date;
}

export interface SocialPostDto {
  id: string;
  body: string;
  matchId: string | null;
  createdAt: string | Date;
  author: { id: string; name: string; skillLevel: SkillLevel | null };
  starCount: number;
  starredByMe: boolean;
  likeCount?: number;
  likedByMe?: boolean;
  commentCount?: number;
}

export interface SocialCommentDto {
  id: string;
  body: string;
  createdAt: string | Date;
  author: { id: string; name: string; skillLevel: SkillLevel | null };
}

export interface PerformanceLeaderboardEntryDto {
  userId: string;
  name: string;
  skillLevel: SkillLevel;
  wins: number;
  losses: number;
  points: number;
  matchesPlayed: number;
  primarySportName: string | null;
}

export interface PlayerSearchHitDto {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  skillLevel: SkillLevel | null;
  points: number;
  isFollowing: boolean;
  fromContacts?: boolean;
}

