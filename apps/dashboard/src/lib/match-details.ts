import type { MatchGenderPreference, OpenMatchDto, SkillLevel } from '@playpk/shared-types';

/** Keep in sync with API OPEN_MATCH_LISTING_TTL_MS — listings leave Upcoming after this. */
export const OPEN_MATCH_LISTING_TTL_MS = 24 * 60 * 60 * 1000;

export function isUpcomingOpenMatch(
  match: Pick<OpenMatchDto, 'createdAt' | 'scheduledAt' | 'status'>,
): boolean {
  if (match.status === 'CANCELLED' || match.status === 'COMPLETED') return false;
  const anchor = match.scheduledAt ? new Date(match.scheduledAt) : new Date(match.createdAt);
  if (Number.isNaN(anchor.getTime())) return false;
  return Date.now() - anchor.getTime() <= OPEN_MATCH_LISTING_TTL_MS;
}

export function genderLabel(value: MatchGenderPreference | string | null | undefined): string {
  switch (value) {
    case 'MEN':
      return "Men's";
    case 'WOMEN':
      return "Women's";
    case 'MIXED':
      return 'Mixed';
    case 'ANY':
      return 'Anyone';
    default:
      return 'Anyone';
  }
}

export function skillBandLabel(min: SkillLevel | string, max: SkillLevel | string): string {
  if (min === max) return String(min);
  return `${min}–${max}`;
}

export function formatMatchWhen(scheduledAt: string | Date | null | undefined): string {
  if (!scheduledAt) return 'Flexible time';
  return new Date(scheduledAt).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function matchVenueLine(match: Pick<OpenMatchDto, 'branch' | 'city'>): string {
  if (match.branch) {
    return `${match.branch.name} · ${match.branch.city}`;
  }
  return match.city?.trim() || 'Venue TBD';
}

export function toIsoFromLocalInput(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}
