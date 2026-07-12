import { ConvexError, v } from 'convex/values';
import { action } from './_generated/server';

declare const process: { env: Record<string, string | undefined> };

type LinkupSource = {
  name?: string;
  title?: string;
  url?: string;
  snippet?: string;
  content?: string;
};

type LinkupResponse = {
  answer?: string;
  sources?: LinkupSource[];
  results?: LinkupSource[];
};

function clean(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function buildSalaryQuery(role: string, city: string, experience: number) {
  return [
    `Find current salary market data for a ${role} in ${city}, India with ${experience} years of experience.`,
    'Return current annual salary ranges in INR LPA, including low, median, high, and recommended negotiation target when available.',
    'Use recent credible sources such as salary reports, job postings, Glassdoor, AmbitionBox, LinkedIn Jobs, Levels.fyi where applicable, and reputable recruiter reports.',
    'Cite every source used and mention publication/date context when available.',
    'If exact role/city data is unavailable, use closest comparable data and state the limitation.',
  ].join(' ');
}

function normalizeSources(response: LinkupResponse) {
  const rawSources = response.sources ?? response.results ?? [];

  return rawSources
    .map((source) => ({
      name: source.name ?? source.title ?? source.url ?? 'Source',
      url: source.url ?? '',
      snippet: source.snippet ?? source.content ?? '',
    }))
    .filter((source) => source.url || source.snippet || source.name !== 'Source')
    .slice(0, 8);
}

export const fetchSalaryData = action({
  args: {
    role: v.string(),
    city: v.string(),
    experience: v.number(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.LINKUP_API_KEY;
    if (!apiKey) {
      return {
        configured: false,
        answer: '',
        sources: [],
        searchedAt: Date.now(),
        query: buildSalaryQuery(clean(args.role), clean(args.city), args.experience),
        error: 'LINKUP_API_KEY is not set in Convex environment variables.',
      };
    }

    const role = clean(args.role);
    const city = clean(args.city);

    if (role.length < 2) throw new ConvexError('Please enter a role for live market research.');
    if (city.length < 2) throw new ConvexError('Please enter a city for live market research.');
    if (!Number.isFinite(args.experience) || args.experience < 0 || args.experience > 45) {
      throw new ConvexError('Experience must be between 0 and 45 years.');
    }

    const query = buildSalaryQuery(role, city, args.experience);
    const response = await fetch('https://api.linkup.so/v1/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        depth: 'standard',
        outputType: 'sourcedAnswer',
        includeInlineCitations: true,
        includeImages: false,
        maxResults: 6,
      }),
    });

    const responseText = await response.text();
    let data: LinkupResponse;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new ConvexError(`Linkup returned a non-JSON response with status ${response.status}.`);
    }

    if (!response.ok) {
      const message = typeof data === 'object' && data && 'error' in data
        ? JSON.stringify(data.error)
        : responseText;
      throw new ConvexError(`Linkup request failed (${response.status}): ${message}`);
    }

    return {
      configured: true,
      answer: data.answer ?? '',
      sources: normalizeSources(data),
      searchedAt: Date.now(),
      query,
      rawResultCount: (data.sources ?? data.results ?? []).length,
    };
  },
});
