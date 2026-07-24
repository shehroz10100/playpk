import type { MatchFormat } from '@playpk/shared-types';

export type FormatOption = { value: MatchFormat; label: string };

const CUSTOM_OPTION: FormatOption = { value: 'CUSTOM', label: 'Custom' };

const RACKET_FORMATS: FormatOption[] = [
  { value: 'SINGLES', label: 'Singles (2 people)' },
  { value: 'DOUBLES', label: 'Doubles (4 people)' },
  CUSTOM_OPTION,
];

const CRICKET_FORMATS: FormatOption[] = [
  { value: 'EIGHT_A_SIDE', label: '8 people' },
  { value: 'TEN_A_SIDE', label: '10 people' },
  { value: 'FOURTEEN_A_SIDE', label: '14 people' },
  CUSTOM_OPTION,
];

/** Futsal, football, basketball, volleyball, etc. — not singles/doubles. */
const TEAM_FORMATS: FormatOption[] = [
  { value: 'FIVE_A_SIDE', label: '5-a-side (10 people)' },
  { value: 'EIGHT_A_SIDE', label: '8 people' },
  { value: 'TEN_A_SIDE', label: '10 people' },
  CUSTOM_OPTION,
];

const DEFAULT_WITH_CUSTOM: FormatOption[] = [
  { value: 'DOUBLES', label: 'Doubles (4 people)' },
  { value: 'SINGLES', label: 'Singles (2 people)' },
  CUSTOM_OPTION,
];

export function isCricketSport(name?: string | null): boolean {
  return (name ?? '').trim().toLowerCase() === 'cricket';
}

export function isRacketSport(name?: string | null): boolean {
  const n = (name ?? '').trim().toLowerCase();
  return [
    'padel',
    'tennis',
    'badminton',
    'squash',
    'pickleball',
    'table tennis',
    'tabletennis',
  ].includes(n);
}

export function isTeamSport(name?: string | null): boolean {
  const n = (name ?? '').trim().toLowerCase();
  return [
    'futsal',
    'football',
    'soccer',
    'basketball',
    'volleyball',
    'hockey',
    'handball',
  ].includes(n);
}

export function formatOptionsForSport(sportName?: string | null): FormatOption[] {
  if (isCricketSport(sportName)) return CRICKET_FORMATS;
  if (isTeamSport(sportName)) return TEAM_FORMATS;
  if (isRacketSport(sportName)) return RACKET_FORMATS;
  return DEFAULT_WITH_CUSTOM;
}

export function defaultFormatForSport(sportName?: string | null): MatchFormat {
  if (isCricketSport(sportName)) return 'EIGHT_A_SIDE';
  if (isTeamSport(sportName)) return 'FIVE_A_SIDE';
  return 'DOUBLES';
}

export function defaultMaxPlayersForCustom(sportName?: string | null): number {
  if (isCricketSport(sportName)) return 10;
  if (isTeamSport(sportName)) return 10;
  return 4;
}

export function formatHintForSport(sportName?: string | null): string {
  if (isCricketSport(sportName)) {
    return 'Cricket sides: 8, 10, or 14 — or choose Custom for your own format.';
  }
  if (isTeamSport(sportName)) {
    return 'Team formats for futsal/football-style games — or choose Custom.';
  }
  if (isRacketSport(sportName)) {
    return 'Singles or doubles for racket sports — or choose Custom.';
  }
  return 'Pick a format, or choose Custom to describe your own.';
}

export function formatLabel(format: string, customFormat?: string | null): string {
  if (format === 'CUSTOM') {
    return customFormat?.trim() || 'Custom';
  }
  switch (format) {
    case 'SINGLES':
      return 'Singles (2)';
    case 'DOUBLES':
      return 'Doubles (4)';
    case 'FIVE_A_SIDE':
      return '5-a-side (10)';
    case 'EIGHT_A_SIDE':
      return '8 people';
    case 'TEN_A_SIDE':
      return '10 people';
    case 'FOURTEEN_A_SIDE':
      return '14 people';
    default:
      return format;
  }
}

export function maxPlayersForFormatValue(format: MatchFormat, override?: number): number {
  if (format === 'CUSTOM' && override && override >= 2) return Math.min(30, override);
  switch (format) {
    case 'SINGLES':
      return 2;
    case 'DOUBLES':
      return 4;
    case 'FIVE_A_SIDE':
      return 10;
    case 'EIGHT_A_SIDE':
      return 8;
    case 'TEN_A_SIDE':
      return 10;
    case 'FOURTEEN_A_SIDE':
      return 14;
    case 'CUSTOM':
      return 4;
    default:
      return 4;
  }
}
