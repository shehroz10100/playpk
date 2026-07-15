import {
  emptyIntent,
  type AvailabilityIntent,
  type LlmProvider,
} from './LlmProvider';

const SPORTS = [
  'padel',
  'cricket',
  'futsal',
  'badminton',
  'tennis',
  'basketball',
  'football',
  'squash',
  'table tennis',
  'volleyball',
  'swimming',
  'bowling',
  'snooker',
  'pickleball',
  'gym',
  'hockey',
];

const CITIES = [
  'lahore',
  'karachi',
  'islamabad',
  'rawalpindi',
  'faisalabad',
  'multan',
  'peshawar',
  'quetta',
];

/** Multi-word first so "johar town" wins over just "town". */
const AREA_PHRASES: Array<{ pattern: RegExp; area: string; city?: string }> = [
  { pattern: /\bjohar\s*town\b/, area: 'Johar Town', city: 'Lahore' },
  { pattern: /\bmodel\s*town\b/, area: 'Model Town', city: 'Lahore' },
  { pattern: /\bgarden\s*town\b/, area: 'Garden Town', city: 'Lahore' },
  { pattern: /\biqbal\s*town\b/, area: 'Iqbal Town', city: 'Lahore' },
  { pattern: /\bwapda\s*town\b/, area: 'Wapda Town', city: 'Lahore' },
  { pattern: /\bbahria\s*town\b/, area: 'Bahria Town', city: 'Lahore' },
  { pattern: /\bdha\s*phase\s*\d+\b/, area: 'DHA', city: 'Lahore' },
  { pattern: /\bphase\s*5\b/, area: 'Phase 5', city: 'Lahore' },
  { pattern: /\bdefence\b/, area: 'DHA', city: 'Lahore' },
  { pattern: /\bdha\b/, area: 'DHA', city: 'Lahore' },
  { pattern: /\bgulberg\b/, area: 'Gulberg', city: 'Lahore' },
  { pattern: /\bbahria\b/, area: 'Bahria', city: 'Lahore' },
  { pattern: /\bcantt\b/, area: 'Cantt', city: 'Lahore' },
  { pattern: /\bclifton\b/, area: 'Clifton', city: 'Karachi' },
  { pattern: /\bf[- ]?7\b/, area: 'F-7', city: 'Islamabad' },
  { pattern: /\bf[- ]?8\b/, area: 'F-8', city: 'Islamabad' },
  { pattern: /\bg\s*11\b/, area: 'G-11', city: 'Islamabad' },
  { pattern: /\bblue\s*area\b/, area: 'Blue Area', city: 'Islamabad' },
];

/**
 * Heuristic parser used when no OpenAI key is configured.
 * Handles questions like "Is padel available tomorrow evening in DHA?"
 * and locality queries such as "padel near johar town".
 */
export class MockLlmProvider implements LlmProvider {
  readonly name = 'mock-rules';

  async parseAvailabilityIntent(question: string, todayIso: string): Promise<AvailabilityIntent> {
    const q = question.toLowerCase();
    const intent = emptyIntent(question);

    for (const sport of SPORTS) {
      if (q.includes(sport)) {
        intent.sport = sport.replace(/\b\w/g, (c) => c.toUpperCase());
        if (sport === 'table tennis') intent.sport = 'Table Tennis';
        break;
      }
    }

    for (const city of CITIES) {
      if (q.includes(city)) {
        intent.city = city.charAt(0).toUpperCase() + city.slice(1);
        break;
      }
    }

    for (const entry of AREA_PHRASES) {
      if (entry.pattern.test(q)) {
        intent.area = entry.area;
        if (!intent.city && entry.city) intent.city = entry.city;
        break;
      }
    }

    const today = new Date(`${todayIso}T00:00:00.000Z`);
    if (/\btomorrow\b/.test(q)) {
      const t = new Date(today);
      t.setUTCDate(t.getUTCDate() + 1);
      intent.date = t.toISOString().slice(0, 10);
    } else if (/\btoday\b/.test(q)) {
      intent.date = todayIso;
    } else if (/\bthis\s+weekend\b/.test(q)) {
      const t = new Date(today);
      const day = t.getUTCDay(); // 0 Sun
      const add = day === 6 ? 0 : day === 0 ? 6 : 6 - day;
      t.setUTCDate(t.getUTCDate() + add);
      intent.date = t.toISOString().slice(0, 10);
    } else {
      const iso = q.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
      if (iso) intent.date = iso[1];
    }

    if (/\bevening\b/.test(q)) {
      intent.timeFrom = '17:00';
      intent.timeTo = '22:00';
    } else if (/\bnight\b/.test(q)) {
      intent.timeFrom = '20:00';
      intent.timeTo = '23:59';
    } else if (/\bmorning\b/.test(q)) {
      intent.timeFrom = '06:00';
      intent.timeTo = '12:00';
    } else if (/\bafternoon\b/.test(q)) {
      intent.timeFrom = '12:00';
      intent.timeTo = '17:00';
    } else {
      const range = q.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:-|to)\s*(\d{1,2})(?::(\d{2}))?\b/);
      if (range) {
        intent.timeFrom = `${String(Number(range[1])).padStart(2, '0')}:${range[2] ?? '00'}`;
        intent.timeTo = `${String(Number(range[3])).padStart(2, '0')}:${range[4] ?? '00'}`;
      }
    }

    return intent;
  }
}
