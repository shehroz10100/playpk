import { prisma } from '../../lib/prisma';
import { searchSlots } from '../slot.service';
import { getLlmProvider, type AvailabilityIntent } from './llm';

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function inTimeWindow(startTime: string, from?: string | null, to?: string | null): boolean {
  const t = toMinutes(startTime);
  if (from && t < toMinutes(from)) return false;
  if (to && t > toMinutes(to)) return false;
  return true;
}

function todayIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

const LOCATION_STOP = new Set([
  'is',
  'are',
  'there',
  'any',
  'near',
  'in',
  'the',
  'a',
  'an',
  'at',
  'to',
  'for',
  'of',
  'on',
  'or',
  'and',
  'me',
  'my',
  'we',
  'you',
  'can',
  'could',
  'please',
  'show',
  'find',
  'looking',
  'want',
  'need',
  'available',
  'availability',
  'slot',
  'slots',
  'court',
  'courts',
  'venue',
  'venues',
  'today',
  'tomorrow',
  'weekend',
  'morning',
  'evening',
  'afternoon',
  'night',
  'this',
  'next',
  'with',
  'from',
  'around',
  'close',
  'closest',
  'nearby',
  'book',
  'booking',
  'play',
  'playing',
  'some',
  'what',
  'which',
  'where',
  'when',
  'how',
  'much',
  'price',
  'pkr',
  'rs',
  'padel',
  'cricket',
  'futsal',
  'badminton',
  'tennis',
  'basketball',
  'football',
  'squash',
  'volleyball',
  'swimming',
  'bowling',
  'snooker',
  'pickleball',
  'gym',
  'hockey',
  'table',
]);

type BranchLocation = {
  id: string;
  name: string;
  city: string;
  address: string;
  companyName: string;
  sports: string[];
};

type LocationMatch = {
  branches: BranchLocation[];
  /** Best label for the answer (area phrase, venue name, or city). */
  label: string | null;
  city: string | null;
};

function tokenizeQuestion(question: string): string[] {
  return (question.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (t) => t.length >= 2 && !LOCATION_STOP.has(t),
  );
}

function scoreBranch(branch: BranchLocation, tokens: string[], areaHint?: string | null): number {
  const haystack = `${branch.name} ${branch.address} ${branch.city} ${branch.companyName}`.toLowerCase();
  let score = 0;

  if (areaHint) {
    const area = areaHint.toLowerCase();
    if (haystack.includes(area)) score += 8;
    for (const part of area.split(/\s+/)) {
      if (part.length >= 3 && haystack.includes(part)) score += 3;
    }
  }

  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += token.length >= 4 ? 4 : 2;
    }
  }

  // Multi-token phrase presence e.g. "johar" + "town"
  if (tokens.length >= 2) {
    const phrase = tokens.slice(0, 3).join(' ');
    if (haystack.includes(phrase)) score += 6;
  }

  return score;
}

/**
 * Match NL location keywords to real branches (name, address, city, company).
 * Works for any venue staff adds — e.g. "Johar Town" → 360 Arena.
 */
export async function resolveLocationMatches(
  question: string,
  intent: AvailabilityIntent,
): Promise<LocationMatch> {
  const branches = await prisma.branch.findMany({
    select: {
      id: true,
      name: true,
      city: true,
      address: true,
      company: { select: { name: true } },
      courts: { select: { sport: { select: { name: true } } } },
    },
  });

  const mapped: BranchLocation[] = branches.map((b) => ({
    id: b.id,
    name: b.name,
    city: b.city,
    address: b.address,
    companyName: b.company.name,
    sports: [...new Set(b.courts.map((c) => c.sport.name))],
  }));

  const tokens = tokenizeQuestion(question);
  const scored = mapped
    .map((b) => ({ branch: b, score: scoreBranch(b, tokens, intent.area) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  // Keep strong matches only (avoid weak single-letter noise)
  const top = scored[0]?.score ?? 0;
  const hits =
    top >= 4
      ? scored.filter((row) => row.score >= Math.max(4, top - 3)).map((row) => row.branch)
      : [];

  if (hits.length > 0) {
    const label =
      intent.area ??
      (tokens.length >= 2 ? `${tokens[0]} ${tokens[1]}` : tokens[0] ?? hits[0].name);
    return {
      branches: hits,
      label: label.replace(/\b\w/g, (c) => c.toUpperCase()),
      city: intent.city ?? hits[0].city,
    };
  }

  // Fallback: intent.area against DB contains
  if (intent.area) {
    const area = intent.area.toLowerCase();
    const areaHits = mapped.filter((b) => {
      const hay = `${b.name} ${b.address} ${b.city}`.toLowerCase();
      return (
        hay.includes(area) ||
        area.split(/\s+/).some((p) => p.length >= 3 && hay.includes(p))
      );
    });
    if (areaHits.length > 0) {
      return {
        branches: areaHits,
        label: intent.area,
        city: intent.city ?? areaHits[0].city,
      };
    }
  }

  return {
    branches: [],
    label: intent.area ?? null,
    city: intent.city ?? null,
  };
}

function branchMatchesText(
  branch: { name: string; address: string; city: string },
  needle: string,
): boolean {
  const area = needle.toLowerCase();
  const hay = `${branch.name} ${branch.address} ${branch.city}`.toLowerCase();
  if (hay.includes(area)) return true;
  return area.split(/\s+/).some((p) => p.length >= 3 && hay.includes(p));
}

/**
 * Chatbot: parse NL intent via LLM interface, then reuse Phase 1 slot search.
 * Location keywords are resolved against live branch name/address/company data.
 */
export async function answerAvailabilityQuestion(question: string) {
  const llm = getLlmProvider();
  const intent: AvailabilityIntent = await llm.parseAvailabilityIntent(question, todayIso());
  const location = await resolveLocationMatches(question, intent);

  let city = location.city ?? intent.city ?? undefined;
  const matchedBranchIds = new Set(location.branches.map((b) => b.id));

  // If locality tokens exist but nothing matched and no city, still try Lahore for PK demo areas
  if (!city && intent.area) {
    city = 'Lahore';
  }

  const search = await searchSlots({
    city,
    sport: intent.sport ?? undefined,
    date: intent.date ?? undefined,
    page: 1,
    pageSize: 80,
  });

  let slots = search.data;

  if (matchedBranchIds.size > 0) {
    slots = slots.filter((s) => matchedBranchIds.has(s.court.branch.id));
  } else if (intent.area || location.label) {
    const area = (intent.area ?? location.label)!.toLowerCase();
    slots = slots.filter((s) =>
      branchMatchesText(
        {
          name: s.court.branch.name,
          address: s.court.branch.address,
          city: s.court.branch.city,
        },
        area,
      ),
    );
  }

  if (intent.timeFrom || intent.timeTo) {
    slots = slots.filter((s) => inTimeWindow(s.startTime, intent.timeFrom, intent.timeTo));
  }

  // Prefer venues that offer the asked sport even when they have no open slots yet
  const sportFilteredVenues =
    intent.sport && location.branches.length > 0
      ? location.branches.filter((b) =>
          b.sports.some((s) => s.toLowerCase() === intent.sport!.toLowerCase()),
        )
      : location.branches;

  const sample = slots.slice(0, 5);
  const answer = formatAnswer({
    intent,
    sample,
    total: slots.length,
    locationLabel: location.label,
    venuesWithoutSlots: slots.length === 0 ? sportFilteredVenues : [],
  });

  return {
    answer,
    intent: {
      ...intent,
      area: location.label ?? intent.area,
      city: city ?? intent.city ?? null,
      resolvedCity: city ?? null,
      matchedBranches: location.branches.map((b) => ({
        id: b.id,
        name: b.name,
        address: b.address,
        city: b.city,
      })),
    },
    llm: llm.name,
    matchCount: slots.length,
    venues: location.branches.map((b) => ({
      id: b.id,
      name: b.name,
      address: b.address,
      city: b.city,
      sports: b.sports,
    })),
    slots: sample.map((s) => ({
      id: s.id,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      price: s.price,
      court: s.court.name,
      sport: s.court.sport.name,
      branch: s.court.branch.name,
      city: s.court.branch.city,
      address: s.court.branch.address,
    })),
  };
}

function formatAnswer(input: {
  intent: AvailabilityIntent;
  sample: Array<{
    startTime: string;
    endTime: string;
    price: number;
    court: {
      name: string;
      sport: { name: string };
      branch: { name: string; city: string; address?: string };
    };
    date: Date | string;
  }>;
  total: number;
  locationLabel: string | null;
  venuesWithoutSlots: BranchLocation[];
}): string {
  const { intent, sample, total, locationLabel, venuesWithoutSlots } = input;
  const sport = intent.sport ?? 'courts';
  const when = intent.date ?? 'the requested time';
  const where =
    [locationLabel, intent.city].filter(Boolean).join(', ') ||
    [intent.area, intent.city].filter(Boolean).join(', ') ||
    'your area';

  if (total === 0 && venuesWithoutSlots.length > 0) {
    const lines = venuesWithoutSlots.map(
      (v) =>
        `• ${v.name} — ${v.address}, ${v.city}` +
        (intent.sport
          ? v.sports.some((s) => s.toLowerCase() === intent.sport!.toLowerCase())
            ? ` (offers ${intent.sport})`
            : ` (sports: ${v.sports.join(', ') || 'n/a'})`
          : ''),
    );
    return `I found ${venuesWithoutSlots.length} venue${venuesWithoutSlots.length === 1 ? '' : 's'} near ${where}, but no open ${sport} slots right now:\n${lines.join('\n')}\nAsk the venue to publish slots, or try another day/time.`;
  }

  if (total === 0) {
    return `I couldn't find available ${sport} slots for ${when} in ${where}. Try a different day, time window, or area.`;
  }

  const lines = sample.map(
    (s) =>
      `• ${s.court.branch.name} — ${s.court.name} (${s.court.sport.name}) ${String(s.date).slice(0, 10)} ${s.startTime}–${s.endTime} · PKR ${s.price}`,
  );

  const more = total > sample.length ? ` (showing ${sample.length} of ${total})` : '';
  return `Yes — I found ${total} available ${sport} slot${total === 1 ? '' : 's'} for ${when} near ${where}${more}:\n${lines.join('\n')}`;
}
