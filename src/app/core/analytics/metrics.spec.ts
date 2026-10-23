import { Activity, Contact, Deal, TeamMember } from '../models';
import { DateRange, previousRange, resolveRange } from './date-range';
import {
  averageDealSizeIn,
  averageSalesCycle,
  closedByMonth,
  computeKpis,
  conversionFunnel,
  historyStart,
  isComparable,
  leadSources,
  pipelineByStage,
  relativeChange,
  revenueIn,
  revenueSeries,
  teamPerformance,
  valueDistribution,
  winRateIn,
} from './metrics';

const NOW = new Date(2026, 5, 15, 12, 0, 0);
const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10, 0, 0).toISOString();

function deal(overrides: Partial<Deal>): Deal {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    name: 'Deal',
    companyId: null,
    contactId: null,
    value: 10_000,
    stage: 'new',
    priority: 'medium',
    ownerId: 'rep-a',
    source: 'website',
    expectedCloseDate: '2026-07-01',
    tags: [],
    notes: '',
    createdAt: iso(2026, 1, 10),
    updatedAt: iso(2026, 1, 10),
    closedAt: null,
    lostAtStage: null,
    ...overrides,
  };
}

/** Range: 1 May – 31 May 2026; previous period: 31 days before. */
const MAY: DateRange = { start: new Date(2026, 4, 1), end: new Date(2026, 4, 31, 23, 59, 59, 999) };

const deals: Deal[] = [
  deal({ id: 'w1', stage: 'won', value: 50_000, closedAt: iso(2026, 5, 5), createdAt: iso(2026, 4, 5) }),
  deal({ id: 'w2', stage: 'won', value: 30_000, closedAt: iso(2026, 5, 20), createdAt: iso(2026, 5, 1), ownerId: 'rep-b' }),
  deal({ id: 'w3', stage: 'won', value: 40_000, closedAt: iso(2026, 4, 15), createdAt: iso(2026, 3, 1) }),
  deal({ id: 'l1', stage: 'lost', value: 20_000, closedAt: iso(2026, 5, 12), lostAtStage: 'proposal', createdAt: iso(2026, 5, 2) }),
  deal({ id: 'o1', stage: 'negotiation', value: 100_000, createdAt: iso(2026, 5, 10) }),
  deal({ id: 'o2', stage: 'new', value: 8_000, createdAt: iso(2026, 5, 25) }),
];

describe('metrics', () => {
  it('counts revenue only from closed-won deals inside the period', () => {
    expect(revenueIn(deals, MAY)).toBe(80_000);
    expect(revenueIn(deals, previousRange(MAY))).toBe(40_000);
  });

  it('computes win rate as won ÷ (won + lost) for deals closed in the period', () => {
    expect(winRateIn(deals, MAY)).toEqual({ rate: 2 / 3, won: 2, lost: 1 });
    expect(winRateIn([], MAY).rate).toBeNull();
  });

  it('computes average deal size from won deals only', () => {
    expect(averageDealSizeIn(deals, MAY)).toBe(40_000);
    expect(averageDealSizeIn([], MAY)).toBeNull();
  });

  it('returns null relative change when there is no prior value', () => {
    expect(relativeChange(10, 0)).toBeNull();
    expect(relativeChange(150, 100)).toBeCloseTo(0.5);
  });

  it('builds a KPI summary with comparisons and open-pipeline snapshot', () => {
    const activities: Activity[] = [
      { id: 'a1', type: 'call', subject: 'Call', description: '', dueAt: iso(2026, 6, 10), completedAt: null, priority: 'low', ownerId: 'rep-a', contactId: null, dealId: null, createdAt: iso(2026, 6, 1), updatedAt: iso(2026, 6, 1) },
      { id: 'a2', type: 'email', subject: 'Email', description: '', dueAt: new Date(2026, 5, 15, 16).toISOString(), completedAt: null, priority: 'low', ownerId: 'rep-a', contactId: null, dealId: null, createdAt: iso(2026, 6, 1), updatedAt: iso(2026, 6, 1) },
      { id: 'a3', type: 'meeting', subject: 'Done', description: '', dueAt: iso(2026, 6, 1), completedAt: iso(2026, 6, 1), priority: 'low', ownerId: 'rep-a', contactId: null, dealId: null, createdAt: iso(2026, 5, 20), updatedAt: iso(2026, 6, 1) },
    ];
    const kpis = computeKpis(deals, activities, MAY, NOW);

    expect(kpis.revenue).toMatchObject({ value: 80_000, previous: 40_000, dealsWon: 2 });
    expect(kpis.revenue.change).toBeCloseTo(1);
    // Pipeline excludes won and lost deals.
    expect(kpis.pipeline.value).toBe(108_000);
    expect(kpis.pipeline.openDeals).toBe(2);
    expect(kpis.pipeline.weighted).toBeCloseTo(100_000 * 0.75 + 8_000 * 0.1);
    expect(kpis.winRate.value).toBeCloseTo(2 / 3);
    expect(kpis.winRate.previous).toBe(1);
    expect(kpis.avgDealSize.value).toBe(40_000);
    expect(kpis.followUps).toEqual({ value: 2, overdue: 1, dueToday: 1 });
  });

  it('suppresses comparisons when the previous period predates recorded history', () => {
    const year = { start: new Date(2025, 5, 1), end: MAY.end };
    const kpis = computeKpis(deals, [], year, NOW);
    expect(kpis.revenue.change).toBeNull();
    expect(kpis.activeDeals.change).toBeNull();
    expect(kpis.winRate.change).toBeNull();
    expect(kpis.avgDealSize.previous).toBeNull();
    expect(isComparable(MAY, historyStart(deals))).toBe(true);
  });

  it('aligns previous-period revenue with the current buckets', () => {
    const points = revenueSeries(deals, MAY, 'month');
    expect(points).toHaveLength(1);
    expect(points[0].revenue).toBe(80_000);
    expect(points[0].dealsWon).toBe(2);
    expect(points[0].previous).toBe(40_000);
  });

  it('summarises open pipeline by stage', () => {
    const stages = pipelineByStage(deals);
    expect(stages.map((s) => s.stage)).toEqual(['new', 'qualified', 'proposal', 'negotiation']);
    expect(stages.find((s) => s.stage === 'negotiation')).toMatchObject({ count: 1, value: 100_000, weighted: 75_000 });
  });

  it('groups closed deals by calendar month', () => {
    const rows = closedByMonth(deals, { start: new Date(2026, 3, 1), end: MAY.end });
    expect(rows.map((r) => [r.won, r.lost])).toEqual([
      [1, 0],
      [2, 1],
    ]);
  });

  it('builds a cohort conversion funnel using the stage a lost deal reached', () => {
    const funnel = conversionFunnel(deals, MAY);
    // Cohort created in May: w2 (won), l1 (lost at proposal), o1 (negotiation), o2 (new).
    expect(funnel.map((f) => f.count)).toEqual([4, 3, 3, 2, 1]);
    expect(funnel.at(-1)!.rate).toBeCloseTo(0.25);
  });

  it('computes average sales cycle in days', () => {
    const cycle = averageSalesCycle(deals, MAY)!;
    expect(cycle).toBeGreaterThan(18);
    expect(cycle).toBeLessThan(26);
  });

  it('pro-rates quarterly quotas to the period for attainment', () => {
    const team: TeamMember[] = [
      { id: 'rep-a', firstName: 'A', lastName: 'One', email: '', role: 'account-executive', quarterlyQuota: 91_250, joinedAt: '2024-01-01' },
      { id: 'rep-b', firstName: 'B', lastName: 'Two', email: '', role: 'account-executive', quarterlyQuota: 91_250, joinedAt: '2024-01-01' },
    ];
    const reps = teamPerformance(deals, team, MAY);
    expect(reps[0].member.id).toBe('rep-a');
    expect(reps[0].revenue).toBe(50_000);
    expect(reps[0].quota).toBe(31_000);
    expect(reps[0].attainment).toBeCloseTo(50_000 / 31_000);
    expect(reps[1].revenue).toBe(30_000);
  });

  it('buckets created deals by value band and outcome', () => {
    const rows = valueDistribution(deals, MAY);
    const total = rows.reduce((sum, r) => sum + r.open + r.won + r.lost, 0);
    expect(total).toBe(4);
    expect(rows.find((r) => r.band === 'gte100k')!.open).toBe(1);
  });

  it('counts new leads per source inside the period', () => {
    const contacts = [
      { source: 'website', createdAt: iso(2026, 5, 3) },
      { source: 'website', createdAt: iso(2026, 2, 3) },
      { source: 'referral', createdAt: iso(2026, 5, 9) },
    ] as Contact[];
    const result = leadSources(contacts, MAY);
    expect(result.find((r) => r.source === 'website')!.count).toBe(1);
    expect(result.find((r) => r.source === 'referral')!.count).toBe(1);
  });
});

describe('date ranges', () => {
  it('resolves presets relative to now', () => {
    const range = resolveRange('last30', NOW);
    expect(range.start).toEqual(new Date(2026, 4, 17));
    expect(range.end.getDate()).toBe(15);

    const months = resolveRange('last6m', NOW);
    expect(months.start).toEqual(new Date(2026, 0, 1));
  });

  it('builds the previous period with identical length', () => {
    const prev = previousRange(MAY);
    expect(prev.end.getTime()).toBe(MAY.start.getTime() - 1);
    expect(MAY.end.getTime() - MAY.start.getTime()).toBe(prev.end.getTime() - prev.start.getTime());
  });

  it('orders custom ranges defensively', () => {
    const range = resolveRange('custom', NOW, { start: '2026-05-20', end: '2026-05-01' });
    expect(range.start).toEqual(new Date(2026, 4, 1));
  });
});
