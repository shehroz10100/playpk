/**
 * LLM provider abstraction for intent parsing (and future NL generation).
 */
export type AvailabilityIntent = {
  sport?: string | null;
  city?: string | null;
  /** Area keyword e.g. DHA, Gulberg — matched against branch name/address */
  area?: string | null;
  date?: string | null; // YYYY-MM-DD
  timeFrom?: string | null; // HH:mm
  timeTo?: string | null; // HH:mm
  rawQuestion: string;
};

export interface LlmProvider {
  readonly name: string;
  parseAvailabilityIntent(question: string, todayIso: string): Promise<AvailabilityIntent>;
}

export function emptyIntent(rawQuestion: string): AvailabilityIntent {
  return {
    sport: null,
    city: null,
    area: null,
    date: null,
    timeFrom: null,
    timeTo: null,
    rawQuestion,
  };
}
