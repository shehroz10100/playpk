import type { MatchGenderPreference, OpenMatchDto, SkillLevel } from '@playpk/shared-types';

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
