/** Shared domain enums & API DTO shapes used by api, mobile, and dashboard. */

/** Flat advance charged at booking time for every sport/court (PKR). */
export const BOOKING_ADVANCE_PKR = 1000;

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum UserRole {
  PLAYER = 'PLAYER',
  COMPANY_OWNER = 'COMPANY_OWNER',
  BRANCH_MANAGER = 'BRANCH_MANAGER',
  FRONT_DESK = 'FRONT_DESK',
  GUEST = 'GUEST',
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

/** Unsplash photo ids (stable). URL size is chosen per use (rail vs hero). */
const SPORT_COVER_PHOTO_IDS: Record<string, string> = {
  Cricket: 'photo-1594470117722-de4b9a02ebed',
  Padel: 'photo-1767128890576-ecc5c643f9c4',
  Futsal: 'photo-1574629810360-7efbbe195018',
  Badminton: 'photo-1626224583764-f87db24ac4ea',
  Snooker: 'photo-1707916041849-927236f6b4c8',
  Gym: 'photo-1517836357463-d25dfeac3438',
  All: 'photo-1504450758481-7338eba7524a',
  Pickleball: 'photo-1693142518820-78d7a05f1546',
  Tennis: 'photo-1554068865-24cecd4e34b8',
  Squash: 'photo-1740813416102-5d42f408bc85',
  Basketball: 'photo-1546519638-68e109498ffc',
  Volleyball: 'photo-1612872087720-bb876e2e67d1',
  'Table Tennis': 'photo-1534158914592-062992fbe900',
  Swimming: 'photo-1530549387789-4c1017266635',
  Bowling: 'photo-1538511059256-46e76f13f071',
};

export type SportCoverVariant = 'rail' | 'hero' | 'card';

function unsplashCoverUrl(photoId: string, variant: SportCoverVariant): string {
  // Rail chips are tall/portrait; heroes & venue cards are landscape.
  // Request 2× display size so retina phones stay sharp.
  const dims =
    variant === 'rail'
      ? 'w=800&h=1200&q=90'
      : variant === 'card'
        ? 'w=1200&h=800&q=90'
        : 'w=1600&h=900&q=90';
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&${dims}`;
}

/** @deprecated Prefer resolveSportCover — kept for callers that read the map directly. */
export const SPORT_COVER_IMAGES: Record<string, string> = Object.fromEntries(
  Object.entries(SPORT_COVER_PHOTO_IDS).map(([name, id]) => [name, unsplashCoverUrl(id, 'hero')]),
);

/** Aliases → canonical sport names used in SPORT_COVER_PHOTO_IDS. */
const SPORT_COVER_ALIASES: Record<string, string> = {
  football: 'Futsal',
  soccer: 'Futsal',
  'table-tennis': 'Table Tennis',
  tabletennis: 'Table Tennis',
  pingpong: 'Table Tennis',
  'ping-pong': 'Table Tennis',
  'ping pong': 'Table Tennis',
  pool: 'Snooker',
  billiards: 'Snooker',
  paddle: 'Padel',
  'paddle tennis': 'Padel',
};

export const DEFAULT_SPORT_COVER = unsplashCoverUrl(SPORT_COVER_PHOTO_IDS.All, 'hero');

function canonicalSportCoverName(name: string): string | null {
  const raw = name.trim();
  if (!raw) return null;
  if (SPORT_COVER_PHOTO_IDS[raw]) return raw;
  const lower = raw.toLowerCase();
  const aliased = SPORT_COVER_ALIASES[lower];
  if (aliased && SPORT_COVER_PHOTO_IDS[aliased]) return aliased;
  const caseMatch = Object.keys(SPORT_COVER_PHOTO_IDS).find((k) => k.toLowerCase() === lower);
  return caseMatch ?? null;
}

/**
 * Prefer curated high-res covers so stale DB iconUrls cannot break the rail.
 * Use variant `rail` for tall sport chips, `hero`/`card` for wide venue surfaces.
 */
export function resolveSportCover(
  name: string,
  iconUrl?: string | null,
  variant: SportCoverVariant = 'hero',
): string {
  const canonical = canonicalSportCoverName(name);
  if (canonical) {
    return unsplashCoverUrl(SPORT_COVER_PHOTO_IDS[canonical], variant);
  }

  // Only use remote CDN iconUrls — never local /uploads paths (often 404 in prod).
  if (
    iconUrl &&
    /^https?:\/\//i.test(iconUrl) &&
    !iconUrl.includes('/uploads/') &&
    /images\.unsplash\.com|cloudinary|imgur|googleusercontent/i.test(iconUrl)
  ) {
    return iconUrl;
  }
  return unsplashCoverUrl(SPORT_COVER_PHOTO_IDS.All, variant);
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
  /** Court base rate before sport discount (when discount applied). */
  basePricePerHour?: number;
  discountPercent?: number | null;
  indoor: boolean;
  hasAC: boolean;
  equipmentAvailable?: string[];
  photos: string[];
  sportId?: string;
  sport: SportDto;
  branchId?: string;
}

export interface VenueSportDiscountDto {
  sportId: string;
  sportName: string;
  percentOff: number;
  label: string | null;
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
  /** Highest active sport discount % at this venue (for badge). */
  discountPercent?: number | null;
  sportDiscounts?: VenueSportDiscountDto[];
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
  | 'FOURTEEN_A_SIDE'
  | 'FIVE_A_SIDE'
  | 'CUSTOM';
export type OpenMatchStatus = 'OPEN' | 'FULL' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type MatchGenderPreference = 'MEN' | 'WOMEN' | 'MIXED' | 'ANY';

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
  phone: string | null;
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
  customFormat: string | null;
  skillMin: SkillLevel;
  skillMax: SkillLevel;
  genderPreference: MatchGenderPreference;
  pricePerPlayer: number | null;
  status: OpenMatchStatus;
  maxPlayers: number;
  joinedCount: number;
  scheduledAt: string | Date | null;
  city: string | null;
  sport: SportDto;
  host: { id: string; name: string; phone: string | null; email: string | null };
  branch: {
    id: string;
    name: string;
    city: string;
    address: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
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
  /** True when an ACCEPTED follow exists from me → them. */
  isFollowing: boolean;
  /** Outgoing follow status from me → them. */
  followStatus?: 'NONE' | 'PENDING' | 'ACCEPTED';
  /** True when they follow me (ACCEPTED). */
  followsMe?: boolean;
  /** Chat is allowed when either direction is ACCEPTED. */
  canChat?: boolean;
  fromContacts?: boolean;
}

export type FollowStatusDto = 'PENDING' | 'ACCEPTED';

export interface SocialConnectionDto {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  skillLevel: SkillLevel | null;
  points: number;
  /** They follow me / I follow them (context depends on list). */
  followStatus: FollowStatusDto;
  followsMe: boolean;
  isFollowing: boolean;
  canChat: boolean;
  since: string | Date;
}

export interface DirectThreadDto {
  id: string;
  otherUser: {
    userId: string;
    name: string;
    skillLevel: SkillLevel | null;
  };
  lastMessage: {
    id: string;
    body: string;
    senderId: string;
    createdAt: string | Date;
  } | null;
  updatedAt: string | Date;
}

export interface DirectMessageDto {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  createdAt: string | Date;
  mine: boolean;
}

export enum ChannelKind {
  SPORT = 'SPORT',
  VENUE = 'VENUE',
  AREA = 'AREA',
  GENERAL = 'GENERAL',
}

export enum ChannelVisibility {
  PUBLIC = 'PUBLIC',
  INVITE = 'INVITE',
}

export enum ChannelMemberRole {
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  MEMBER = 'MEMBER',
}

export interface ChatChannelDto {
  id: string;
  name: string;
  description: string | null;
  kind: ChannelKind | string;
  visibility: ChannelVisibility | string;
  sportId: string | null;
  branchId: string | null;
  city: string | null;
  sportName: string | null;
  venueName: string | null;
  venueCity: string | null;
  createdById: string;
  createdByName: string | null;
  memberCount: number;
  messageCount: number;
  myRole: ChannelMemberRole | string | null;
  lastMessage: {
    body: string;
    createdAt: string | Date;
    senderName: string;
  } | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ChannelMemberDto {
  userId: string;
  name: string;
  role: ChannelMemberRole | string;
  joinedAt: string | Date;
  muted: boolean;
}

export interface ChannelMessageDto {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string | Date;
  mine: boolean;
}

export interface ChannelInviteHitDto {
  userId: string;
  name: string;
  email: string | null;
}



