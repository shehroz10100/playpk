import type { PricingModel, PricingSuggestion, PricingSuggestionInput } from './PricingModel';

/**
 * Simple heuristic pricing:
 *  +20% weekends (Sat/Sun)
 *  +30% holidays
 *  +15% peak hours 18:00–21:00
 *  +10% extra if historical occupancy ≥ 70% for that weekday/hour
 */
export class RulesBasedPricingModel implements PricingModel {
  readonly name = 'rules-v1';

  suggest(input: PricingSuggestionInput): PricingSuggestion {
    const weekend = input.flags.isWeekend ? 1.2 : 1;
    const holiday = input.flags.isHoliday ? 1.3 : 1;
    const peak = input.flags.isPeakHour ? 1.15 : 1;
    const demand =
      input.flags.historicalOccupancy != null && input.flags.historicalOccupancy >= 0.7
        ? 1.1
        : 1;

    const multiplier = weekend * holiday * peak * demand;
    const suggestedPrice = Math.round(input.basePrice * multiplier);

    const reasons: string[] = [];
    if (input.flags.isWeekend) reasons.push('+20% weekend');
    if (input.flags.isHoliday) reasons.push('+30% holiday');
    if (input.flags.isPeakHour) reasons.push('+15% peak (18:00–21:00)');
    if (demand > 1) {
      reasons.push(
        `+10% high historical demand (${Math.round((input.flags.historicalOccupancy ?? 0) * 100)}%)`,
      );
    }
    if (reasons.length === 0) reasons.push('Base court rate (no uplift)');

    return {
      slotId: input.slotId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      currentPrice: input.basePrice,
      suggestedPrice,
      currency: 'PKR',
      multipliers: { weekend, holiday, peak, demand },
      reasons,
      model: this.name,
    };
  }
}
