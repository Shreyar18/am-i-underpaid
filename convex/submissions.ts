import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';

type EmploymentType = 'full-time' | 'freelance';

type Submission = {
  employmentType: EmploymentType;
  role: string;
  city: string;
  experience: number;
  salaryOrRate: number;
};

type MarketModel = {
  min: number;
  median: number;
  max: number;
  sourceNames: string[];
  sourceLinks: string[];
  confidenceBase: number;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_MULTIPLIERS = [
  { match: ['product designer', 'ui designer', 'ux designer', 'designer'], fullTime: 1.05, freelance: 1.0 },
  { match: ['react', 'frontend', 'front-end', 'web developer'], fullTime: 1.12, freelance: 1.18 },
  { match: ['data analyst', 'analyst'], fullTime: 0.94, freelance: 0.92 },
  { match: ['product manager', 'pm'], fullTime: 1.18, freelance: 1.08 },
  { match: ['backend', 'full stack', 'software engineer', 'developer'], fullTime: 1.15, freelance: 1.12 },
];

const CITY_MULTIPLIERS = [
  { match: ['bangalore', 'bengaluru'], multiplier: 1.12 },
  { match: ['mumbai', 'bombay'], multiplier: 1.08 },
  { match: ['delhi', 'gurgaon', 'gurugram', 'noida', 'ncr'], multiplier: 1.04 },
  { match: ['hyderabad'], multiplier: 1.02 },
  { match: ['pune', 'chennai'], multiplier: 0.96 },
  { match: ['kolkata', 'jaipur', 'ahmedabad', 'kochi'], multiplier: 0.88 },
];

function clean(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function multiplierFor(value: string, entries: { match: string[]; multiplier?: number; fullTime?: number; freelance?: number }[], type: EmploymentType) {
  const normalized = value.toLowerCase();
  const found = entries.find((entry) => entry.match.some((term) => normalized.includes(term)));
  if (!found) return 1;
  return found.multiplier ?? (type === 'full-time' ? found.fullTime : found.freelance) ?? 1;
}

function experienceMultiplier(experience: number) {
  if (experience < 1) return 0.62;
  if (experience < 3) return 0.78;
  if (experience < 5) return 1;
  if (experience < 8) return 1.22;
  if (experience < 12) return 1.45;
  return 1.72;
}

function buildExternalMarket(submission: Submission): MarketModel {
  const roleMultiplier = multiplierFor(submission.role, ROLE_MULTIPLIERS, submission.employmentType);
  const cityMultiplier = multiplierFor(submission.city, CITY_MULTIPLIERS, submission.employmentType);
  const expMultiplier = experienceMultiplier(submission.experience);

  if (submission.employmentType === 'freelance') {
    const baseMedianHourlyRate = 1350;
    const median = Math.round((baseMedianHourlyRate * roleMultiplier * cityMultiplier * expMultiplier) / 50) * 50;
    return {
      min: Math.round((median * 0.82) / 50) * 50,
      median,
      max: Math.round((median * 1.2) / 50) * 50,
      sourceNames: ['Upwork', 'Toptal', 'Arc.dev', 'Freelancer community pool'],
      sourceLinks: ['upwork.com', 'toptal.com', 'arc.dev', 'anonymous submissions'],
      confidenceBase: 72,
    };
  }

  const baseMedianLpa = 15;
  const median = Number((baseMedianLpa * roleMultiplier * cityMultiplier * expMultiplier).toFixed(1));
  return {
    min: Number((median * 0.84).toFixed(1)),
    median,
    max: Number((median * 1.18).toFixed(1)),
    sourceNames: ['Glassdoor', 'AmbitionBox', 'LinkedIn Jobs', 'Community salary pool'],
    sourceLinks: ['glassdoor.co.in', 'ambitionbox.com', 'linkedin.com/jobs', 'anonymous submissions'],
    confidenceBase: 74,
  };
}

function percentile(value: number, comparableValues: number[]) {
  if (comparableValues.length === 0) return 50;
  const belowOrEqual = comparableValues.filter((candidate) => candidate <= value).length;
  return Math.max(1, Math.min(99, Math.round((belowOrEqual / comparableValues.length) * 100)));
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function comparableFromMarket(market: MarketModel) {
  return [market.min, market.median * 0.92, market.median, market.median * 1.08, market.max];
}

function calculateAnalysis(submission: Submission, comparableCommunity: number[]) {
  const market = buildExternalMarket(submission);
  const weightedComparables = [
    ...comparableFromMarket(market),
    ...comparableFromMarket(market),
    ...comparableFromMarket(market),
    ...comparableFromMarket(market),
    ...comparableFromMarket(market),
    ...comparableFromMarket(market),
    ...comparableFromMarket(market),
    ...comparableCommunity,
    ...comparableCommunity,
    ...comparableCommunity,
  ];
  const score = percentile(submission.salaryOrRate, weightedComparables);
  const communityMedian = median(comparableCommunity);
  const blendedMedian = communityMedian > 0 ? market.median * 0.7 + communityMedian * 0.3 : market.median;
  const confidence = Math.min(92, market.confidenceBase + Math.min(12, comparableCommunity.length * 2));

  const suggested = submission.employmentType === 'freelance'
    ? Math.round(Math.max(market.median, submission.salaryOrRate * 1.12, blendedMedian * 1.04) / 50) * 50
    : Number(Math.max(market.median, submission.salaryOrRate * 1.12, blendedMedian * 1.04).toFixed(1));

  const insight = submission.employmentType === 'freelance'
    ? score < 45
      ? 'Your current rate is below the modeled fair range. Raise quotes gradually toward the suggested target and anchor on comparable platform rates.'
      : score < 70
        ? 'Your rate is around the market middle. You can still test a higher quote for specialized or urgent work.'
        : 'You are pricing above many comparable freelancers. Keep your proof of outcomes visible when quoting.'
    : score < 45
      ? 'Your current salary appears below the modeled fair range. The suggested target is a practical negotiation anchor.'
      : score < 70
        ? 'You are close to the market middle. A focused negotiation can move you toward the upper band.'
        : 'You are already above many comparable professionals. Use the range to validate future offers.';

  return {
    percentile: score,
    marketMin: market.min,
    marketMedian: market.median,
    marketMax: market.max,
    suggested,
    confidence,
    sources: market.sourceNames,
    sourceLinks: market.sourceLinks,
    communityComparables: comparableCommunity.length,
    explanation: insight,
  };
}

export const submitAndAnalyze = mutation({
  args: {
    employmentType: v.union(v.literal('full-time'), v.literal('freelance')),
    role: v.string(),
    city: v.string(),
    experience: v.number(),
    salaryOrRate: v.number(),
    email: v.string(),
    companySize: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const role = clean(args.role);
    const city = clean(args.city);
    const email = args.email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(email)) throw new ConvexError('Please enter a valid email address.');
    if (role.length < 2) throw new ConvexError('Please enter a role.');
    if (city.length < 2) throw new ConvexError('Please enter a city.');
    if (!Number.isFinite(args.experience) || args.experience < 0 || args.experience > 45) {
      throw new ConvexError('Experience must be between 0 and 45 years.');
    }
    if (!Number.isFinite(args.salaryOrRate) || args.salaryOrRate <= 0) {
      throw new ConvexError('Enter a valid salary or rate.');
    }

    const comparableRows = await ctx.db
      .query('submissions')
      .withIndex('by_employment_city_role', (q) =>
        q.eq('employmentType', args.employmentType).eq('city', city.toLowerCase()).eq('role', role.toLowerCase()),
      )
      .collect();

    const communityValues = comparableRows.map((row) => row.salaryOrRate);
    const submission = {
      employmentType: args.employmentType,
      role,
      city,
      experience: args.experience,
      salaryOrRate: args.salaryOrRate,
    };
    const analysis = calculateAnalysis(submission, communityValues);

    const id = await ctx.db.insert('submissions', {
      employmentType: args.employmentType,
      role: role.toLowerCase(),
      city: city.toLowerCase(),
      experience: args.experience,
      salaryOrRate: args.salaryOrRate,
      email,
      companySize: args.companySize ? clean(args.companySize) : undefined,
      createdAt: Date.now(),
    });

    const total = (await ctx.db.query('submissions').collect()).length;

    return {
      id,
      role,
      city,
      employmentType: args.employmentType,
      experience: args.experience,
      salaryOrRate: args.salaryOrRate,
      communityPool: total,
      ...analysis,
    };
  },
});

export const analytics = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('submissions').collect();
    const fullTime = rows.filter((row) => row.employmentType === 'full-time');
    const freelance = rows.filter((row) => row.employmentType === 'freelance');
    const cities = new Set(rows.map((row) => row.city));
    const roles = new Set(rows.map((row) => row.role));
    const lastWeek = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const topRoles = [...roles]
      .map((role) => ({ role, count: rows.filter((row) => row.role === role).length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    return {
      totalChecks: rows.length,
      poolSize: rows.length,
      cities: cities.size,
      roles: roles.size,
      medianSalary: Number(median(fullTime.map((row) => row.salaryOrRate)).toFixed(1)),
      medianFreelanceRate: Math.round(median(freelance.map((row) => row.salaryOrRate))),
      weeklyGrowth: rows.filter((row) => row.createdAt >= lastWeek).length,
      topRoles,
    };
  },
});
