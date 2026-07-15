import { appConfig } from '../../../config/env';
import {
  emptyIntent,
  type AvailabilityIntent,
  type LlmProvider,
} from './LlmProvider';
import { MockLlmProvider } from './MockLlmProvider';

/**
 * OpenAI Chat Completions intent parser. Falls back to mock on failure.
 */
export class OpenAiLlmProvider implements LlmProvider {
  readonly name = 'openai';
  private fallback = new MockLlmProvider();

  async parseAvailabilityIntent(question: string, todayIso: string): Promise<AvailabilityIntent> {
    const key = appConfig.llm.openaiApiKey;
    if (!key) {
      return this.fallback.parseAvailabilityIntent(question, todayIso);
    }

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: appConfig.llm.openaiModel,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `Extract sports venue availability search intent from a Pakistan booking app question.
Today is ${todayIso} (UTC). Return JSON only:
{"sport":string|null,"city":string|null,"area":string|null,"date":"YYYY-MM-DD"|null,"timeFrom":"HH:mm"|null,"timeTo":"HH:mm"|null}
sport examples: Padel, Cricket, Futsal, Badminton. area is a locality or neighborhood like DHA, Johar Town, Gulberg, Model Town, Clifton — never invent venues.`,
            },
            { role: 'user', content: question },
          ],
        }),
      });

      if (!res.ok) {
        console.warn(`[OpenAI] HTTP ${res.status}, falling back to mock`);
        return this.fallback.parseAvailabilityIntent(question, todayIso);
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(content) as Partial<AvailabilityIntent>;
      return {
        ...emptyIntent(question),
        sport: parsed.sport ?? null,
        city: parsed.city ?? null,
        area: parsed.area ?? null,
        date: parsed.date ?? null,
        timeFrom: parsed.timeFrom ?? null,
        timeTo: parsed.timeTo ?? null,
      };
    } catch (error) {
      console.warn('[OpenAI] parse failed, using mock:', error);
      return this.fallback.parseAvailabilityIntent(question, todayIso);
    }
  }
}
