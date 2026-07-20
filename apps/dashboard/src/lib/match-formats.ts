import type { MatchFormat } from '@playpk/shared-types';

export type FormatOption = { value: MatchFormat; label: string };

const RACKET_FORMATS: FormatOption[] = [
  { value: 'SINGLES', label: 'Singles (2 people)' },
  { value: 'DOUBLES', label: 'Doubles (4 people)' },
];

const CRICKET_FORMATS: FormatOption[] = [
  { value: 'EIGHT_A_SIDE', label: '8 people' },
  { value: 'TEN_A_SIDE', label: '10 people' },
  { value: 'FOURTEEN_A_SIDE', label: '14 people' },
];

export function isCricketSport(name?: string | null): boolean {
  return (name ?? '').trim().toLowerCase() === 'cricket';
}

export function formatOptionsForSport(sportName?: string | null): FormatOption[] {
  return isCricketSport(sportName) ? CRICKET_FORMATS : RACKET_FORMATS;
}

export function defaultFormatForSport(sportName?: string | null): MatchFormat {
  return isCricketSport(sportName) ? 'EIGHT_A_SIDE' : 'DOUBLES';
}

export function formatLabel(format: string): string {
  switch (format) {
    case 'SINGLES':
      return 'Singles (2)';
    case 'DOUBLES':
      return 'Doubles (4)';
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
