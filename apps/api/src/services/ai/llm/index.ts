import { appConfig } from '../../../config/env';
import type { LlmProvider } from './LlmProvider';
import { MockLlmProvider } from './MockLlmProvider';
import { OpenAiLlmProvider } from './OpenAiLlmProvider';

let cached: LlmProvider | null = null;

export function getLlmProvider(): LlmProvider {
  if (cached) return cached;
  if (appConfig.llm.provider === 'openai' && appConfig.llm.openaiApiKey) {
    cached = new OpenAiLlmProvider();
  } else {
    cached = new MockLlmProvider();
  }
  return cached;
}

export type { LlmProvider, AvailabilityIntent } from './LlmProvider';
