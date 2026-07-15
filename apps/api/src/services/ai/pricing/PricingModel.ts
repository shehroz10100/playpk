/**
 * Pricing model abstraction — RulesBased for MVP, swap for ML later.
 */
export type PricingContextFlags = {
  isWeekend: boolean;
  isHoliday: boolean;
  isPeakHour: boolean;
  /** 0–1 historical occupancy for same weekday/hour bucket; null if unknown */
  historicalOccupancy: number | null;
};

export type PricingSuggestionInput = {
  courtId: string;
  basePrice: number;
  slotId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;
  flags: PricingContextFlags;
};

export type PricingSuggestion = {
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
};

export interface PricingModel {
  readonly name: string;
  suggest(input: PricingSuggestionInput): PricingSuggestion;
}
