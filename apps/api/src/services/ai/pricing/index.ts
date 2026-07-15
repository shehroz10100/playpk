import type { PricingModel } from './PricingModel';
import { RulesBasedPricingModel } from './RulesBasedPricingModel';

let cached: PricingModel | null = null;

/** Factory so an ML model can replace RulesBased later without changing callers. */
export function getPricingModel(): PricingModel {
  if (!cached) {
    cached = new RulesBasedPricingModel();
  }
  return cached;
}

export type { PricingModel, PricingSuggestion } from './PricingModel';
