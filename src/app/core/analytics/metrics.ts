import { isActivityOverdue } from '../domain/activity-rules';
import { weightedValue } from '../domain/deal-rules';
import {
  Activity,
  Contact,
  Deal,
  DEAL_STAGES,
  isOpenStage,
  LEAD_SOURCES,
  LeadSource,
  OPEN_STAGES,
  OpenStage,
  TeamMember,
} from '../models';
import { addDays, DAY_MS, startOfDay } from '../../shared/utils/date';
import {
  Bucket,
  bucketIndex,
  buildBuckets,
  DateRange,
  Granularity,
  inRange,
  previousRange,
  rangeDuration,
} from './date-range';

/**
 * Metric definitions (documented in docs/METRICS.md):
 *  • Revenue          — sum of `value` for Won deals whose `closedAt` falls in the period.
 *  • Pipeline value   — sum of `value` for open deals (New → Negotiation), as of now.
 *  • Weighted value   — pipeline value × stage probability.
 *  • Win rate         — Won ÷ (Won + Lost) for deals closed in the period.
 *  • Avg. deal size   — revenue ÷ number of Won deals in the period.
 *  • Open follow-ups  — activities not yet completed; overdue when due before today.
 * Comparisons use the immediately preceding period of equal length, and are only
 * shown when that whole period is covered by recorded history (see historyStart).
 */

/** Earliest record date — periods before it have no data, so comparisons would mislead. */
export function historyStart(deals: readonly Deal[]): Date | null {
  if (deals.length === 0) return null;
  return new Date(deals.reduce((min, d) => (d.createdAt < min ? d.createdAt : min), deals[0].createdAt));
}

/** True when the previous period lies entirely inside recorded history. */
export function isComparable(range: DateRange, history: Date | null): boolean {
  return history !== null && previousRange(range).start >= history;
}

/** Relative change; `null` when there is no prior value to compare against. */
export function relativeChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

const isWonIn = (d: Deal, range: DateRange) => d.stage === 'won' && inRange(d.closedAt, range);
const isLostIn = (d: Deal, range: DateRange) => d.stage === 'lost' && inRange(d.closedAt, range);

export function revenueIn(deals: readonly Deal[], range: DateRange): number {
  return deals.filter((d) => isWonIn(d, range)).reduce((sum, d) => sum + d.value, 0);
}

export function winRateIn(deals: readonly Deal[], range: DateRange): { rate: number | null; won: number; lost: number } {
  const won = deals.filter((d) => isWonIn(d, range)).length;
  const lost = deals.filter((d) => isLostIn(d, range)).length;
  return { rate: won + lost === 0 ? null : won / (won + lost), won, lost };
}

export function averageDealSizeIn(deals: readonly Deal[], range: DateRange): number | null {
  const won = deals.filter((d) => isWonIn(d, range));
  if (won.length === 0) return null;
  return won.reduce((sum, d) => sum + d.value, 0) / won.length;
}

export interface KpiSummary {
  revenue: { value: number; previous: number; change: number | null; dealsWon: number };
  pipeline: { value: number; weighted: number; openDeals: number };
  activeDeals: { value: number; created: number; createdPrevious: number; change: number | null };
  winRate: { value: number | null; previous: number | null; change: number | null; won: number; lost: number };
  avgDealSize: { value: number | null; previous: number | null; change: number | null };
  followUps: { value: number; overdue: number; dueToday: number };
}

export function computeKpis(
  deals: readonly Deal[],
  activities: readonly Activity[],
  range: DateRange,
  now: Date,
  history: Date | null = historyStart(deals),
): KpiSummary {
  const prev = previousRange(range);
  const comparable = isComparable(range, history);
  const change = (current: number, previous: number) => (comparable ? relativeChange(current, previous) : null);

  const revenue = revenueIn(deals, range);
  const revenuePrev = revenueIn(deals, prev);
  const win = winRateIn(deals, range);
  const winPrev = winRateIn(deals, prev);
  const avg = averageDealSizeIn(deals, range);
  const avgPrev = averageDealSizeIn(deals, prev);
  const open = deals.filter((d) => isOpenStage(d.stage));
  const created = deals.filter((d) => inRange(d.createdAt, range)).length;
  const createdPrev = deals.filter((d) => inRange(d.createdAt, prev)).length;

  const pending = activities.filter((a) => a.completedAt === null);
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);

  return {
    revenue: { value: revenue, previous: revenuePrev, change: change(revenue, revenuePrev), dealsWon: win.won },
    pipeline: {
      value: open.reduce((sum, d) => sum + d.value, 0),
      weighted: open.reduce((sum, d) => sum + weightedValue(d), 0),
      openDeals: open.length,
    },
    activeDeals: { value: open.length, created, createdPrevious: createdPrev, change: change(created, createdPrev) },
    winRate: {
      value: win.rate,
      previous: comparable ? winPrev.rate : null,
      // Absolute difference in percentage points (0.05 = +5 pts).
      change: comparable && win.rate !== null && winPrev.rate !== null ? win.rate - winPrev.rate : null,
      won: win.won,
      lost: win.lost,
    },
    avgDealSize: {
      value: avg,
      previous: comparable ? avgPrev : null,
      change: comparable && avg !== null && avgPrev !== null ? relativeChange(avg, avgPrev) : null,
    },
    followUps: {
      value: pending.length,
      overdue: pending.filter((a) => isActivityOverdue(a, now)).length,
      dueToday: pending.filter((a) => {
        const due = new Date(a.dueAt);
        return due >= today && due < tomorrow;
      }).length,
    },
  };
}

export interface RevenuePoint {
  bucket: Bucket;
  revenue: number;
  previous: number;
  dealsWon: number;
}

/**
 * Revenue per bucket, with the previous period aligned position-by-position
 * (each prior close date is shifted forward by the period length).
 */
export function revenueSeries(deals: readonly Deal[], range: DateRange, granularity: Granularity): RevenuePoint[] {
  const buckets = buildBuckets(range, granularity);
  const points = buckets.map((bucket) => ({ bucket, revenue: 0, previous: 0, dealsWon: 0 }));
  const prev = previousRange(range);
  const shift = rangeDuration(range);

  for (const deal of deals) {
    if (deal.stage !== 'won' || !deal.closedAt) continue;
    const closed = new Date(deal.closedAt);
    if (inRange(deal.closedAt, range)) {
      const i = bucketIndex(buckets, closed);
      if (i >= 0) {
        points[i].revenue += deal.value;
        points[i].dealsWon += 1;
      }
    } else if (inRange(deal.closedAt, prev)) {
      const i = bucketIndex(buckets, new Date(closed.getTime() + shift));
      if (i >= 0) points[i].previous += deal.value;
    }
  }
  return points;
}

export interface StageSummary {
  stage: OpenStage;
  count: number;
  value: number;
  weighted: number;
}

export function pipelineByStage(deals: readonly Deal[]): StageSummary[] {
  return OPEN_STAGES.map((stage) => {
    const inStage = deals.filter((d) => d.stage === stage);
    return {
      stage,
      count: inStage.length,
      value: inStage.reduce((sum, d) => sum + d.value, 0),
      weighted: inStage.reduce((sum, d) => sum + weightedValue(d), 0),
    };
  });
}

export interface SourceCount {
  source: LeadSource;
  count: number;
}

/** New leads (contacts created in the period) per acquisition source. */
export function leadSources(contacts: readonly Contact[], range: DateRange): SourceCount[] {
  return LEAD_SOURCES.map((source) => ({
    source,
    count: contacts.filter((c) => c.source === source && inRange(c.createdAt, range)).length,
  }));
}

export interface MonthlyWon {
  bucket: Bucket;
  won: number;
  lost: number;
  value: number;
}

export function closedByMonth(deals: readonly Deal[], range: DateRange): MonthlyWon[] {
  const buckets = buildBuckets(range, 'month');
  const rows = buckets.map((bucket) => ({ bucket, won: 0, lost: 0, value: 0 }));
  for (const deal of deals) {
    if (!deal.closedAt || !inRange(deal.closedAt, range)) continue;
    const i = bucketIndex(buckets, new Date(deal.closedAt));
    if (i < 0) continue;
    if (deal.stage === 'won') {
      rows[i].won += 1;
      rows[i].value += deal.value;
    } else if (deal.stage === 'lost') {
      rows[i].lost += 1;
    }
  }
  return rows;
}

export interface RepPerformance {
  member: TeamMember;
  revenue: number;
  won: number;
  lost: number;
  winRate: number | null;
  openPipeline: number;
  openDeals: number;
  averageDealSize: number | null;
  /** Quarterly quota pro-rated to the period length. */
  quota: number;
  attainment: number | null;
}

export function teamPerformance(
  deals: readonly Deal[],
  team: readonly TeamMember[],
  range: DateRange,
): RepPerformance[] {
  const days = rangeDuration(range) / DAY_MS;
  return team
    .map((member) => {
      const owned = deals.filter((d) => d.ownerId === member.id);
      const revenue = revenueIn(owned, range);
      const win = winRateIn(owned, range);
      const open = owned.filter((d) => isOpenStage(d.stage));
      const quota = Math.round((member.quarterlyQuota * days) / 91.25);
      return {
        member,
        revenue,
        won: win.won,
        lost: win.lost,
        winRate: win.rate,
        openPipeline: open.reduce((sum, d) => sum + d.value, 0),
        openDeals: open.length,
        averageDealSize: averageDealSizeIn(owned, range),
        quota,
        attainment: quota > 0 ? revenue / quota : null,
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.openPipeline - a.openPipeline);
}

export interface FunnelStep {
  stage: OpenStage | 'won';
  count: number;
  /** Share of the cohort that reached this step (0..1). */
  rate: number;
}

/**
 * Conversion funnel for deals created in the period. Stages are sequential, so a
 * deal "reached" every stage up to its current one; lost deals count up to the
 * stage where they were lost (`lostAtStage`).
 */
export function conversionFunnel(deals: readonly Deal[], range: DateRange): FunnelStep[] {
  const cohort = deals.filter((d) => inRange(d.createdAt, range));
  const order = (stage: OpenStage | 'won') => (stage === 'won' ? OPEN_STAGES.length : OPEN_STAGES.indexOf(stage));
  const reachedIndex = (d: Deal): number => {
    if (d.stage === 'won') return OPEN_STAGES.length;
    if (d.stage === 'lost') return d.lostAtStage ? OPEN_STAGES.indexOf(d.lostAtStage) : 0;
    return OPEN_STAGES.indexOf(d.stage);
  };
  const steps: (OpenStage | 'won')[] = [...OPEN_STAGES, 'won'];
  return steps.map((stage) => {
    const count = cohort.filter((d) => reachedIndex(d) >= order(stage)).length;
    return { stage, count, rate: cohort.length === 0 ? 0 : count / cohort.length };
  });
}

/** Average days from creation to close for deals won in the period. */
export function averageSalesCycle(deals: readonly Deal[], range: DateRange): number | null {
  const won = deals.filter((d) => isWonIn(d, range));
  if (won.length === 0) return null;
  const total = won.reduce((sum, d) => sum + (new Date(d.closedAt!).getTime() - new Date(d.createdAt).getTime()), 0);
  return total / won.length / DAY_MS;
}

export const VALUE_BANDS = [
  { key: 'lt10k', min: 0, max: 10_000 },
  { key: '10to25k', min: 10_000, max: 25_000 },
  { key: '25to50k', min: 25_000, max: 50_000 },
  { key: '50to100k', min: 50_000, max: 100_000 },
  { key: 'gte100k', min: 100_000, max: Number.POSITIVE_INFINITY },
] as const;
export type ValueBand = (typeof VALUE_BANDS)[number]['key'];

export interface ValueBandRow {
  band: ValueBand;
  open: number;
  won: number;
  lost: number;
}

/** Deals created in the period, grouped by deal size and outcome. */
export function valueDistribution(deals: readonly Deal[], range: DateRange): ValueBandRow[] {
  const cohort = deals.filter((d) => inRange(d.createdAt, range));
  return VALUE_BANDS.map((band) => {
    const inBand = cohort.filter((d) => d.value >= band.min && d.value < band.max);
    return {
      band: band.key,
      open: inBand.filter((d) => isOpenStage(d.stage)).length,
      won: inBand.filter((d) => d.stage === 'won').length,
      lost: inBand.filter((d) => d.stage === 'lost').length,
    };
  });
}

export interface SourceInsight {
  source: LeadSource;
  leads: number;
  dealsCreated: number;
  revenue: number;
  winRate: number | null;
}

export function sourceInsights(
  contacts: readonly Contact[],
  deals: readonly Deal[],
  range: DateRange,
): SourceInsight[] {
  return LEAD_SOURCES.map((source) => {
    const sourced = deals.filter((d) => d.source === source);
    return {
      source,
      leads: contacts.filter((c) => c.source === source && inRange(c.createdAt, range)).length,
      dealsCreated: sourced.filter((d) => inRange(d.createdAt, range)).length,
      revenue: revenueIn(sourced, range),
      winRate: winRateIn(sourced, range).rate,
    };
  });
}

export function stageTotals(deals: readonly Deal[]) {
  return DEAL_STAGES.map((stage) => {
    const inStage = deals.filter((d) => d.stage === stage);
    return { stage, count: inStage.length, value: inStage.reduce((sum, d) => sum + d.value, 0) };
  });
}
