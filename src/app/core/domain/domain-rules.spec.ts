import { Activity, Deal } from '../models';
import { activityBucket, completionChange, isActivityOverdue } from './activity-rules';
import { dealProbability, isDealOverdue, normalizeTags, stageChange, stageEventKind, weightedValue } from './deal-rules';

const NOW = new Date(2026, 5, 15, 12, 0, 0);

const baseDeal = (overrides: Partial<Deal> = {}): Deal => ({
  id: 'd1',
  name: 'Deal',
  companyId: null,
  contactId: null,
  value: 20_000,
  stage: 'proposal',
  priority: 'high',
  ownerId: 'tm',
  source: 'event',
  expectedCloseDate: '2026-06-30',
  tags: [],
  notes: '',
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
  closedAt: null,
  lostAtStage: null,
  ...overrides,
});

describe('deal pipeline movement rules', () => {
  it('stamps closedAt when a deal is won', () => {
    const changes = stageChange(baseDeal(), 'won', NOW);
    expect(changes).toMatchObject({ stage: 'won', closedAt: NOW.toISOString(), lostAtStage: null });
  });

  it('records the last open stage when a deal is lost', () => {
    expect(stageChange(baseDeal({ stage: 'negotiation' }), 'lost', NOW).lostAtStage).toBe('negotiation');
    expect(stageChange(baseDeal({ stage: 'won', closedAt: NOW.toISOString() }), 'lost', NOW).lostAtStage).toBe('negotiation');
  });

  it('clears close data when a closed deal is reopened', () => {
    const won = baseDeal({ stage: 'won', closedAt: '2026-06-01T00:00:00.000Z' });
    expect(stageChange(won, 'qualified', NOW)).toMatchObject({ stage: 'qualified', closedAt: null, lostAtStage: null });
  });

  it('returns no changes when the stage is unchanged', () => {
    expect(stageChange(baseDeal(), 'proposal', NOW)).toEqual({});
  });

  it('maps stages to timeline event kinds', () => {
    expect(stageEventKind('won')).toBe('deal-won');
    expect(stageEventKind('lost')).toBe('deal-lost');
    expect(stageEventKind('qualified')).toBe('deal-stage-changed');
  });

  it('derives probability and weighted value from the stage', () => {
    expect(dealProbability(baseDeal())).toBe(50);
    expect(weightedValue(baseDeal())).toBe(10_000);
    expect(weightedValue(baseDeal({ stage: 'lost' }))).toBe(0);
  });

  it('flags open deals past their expected close date', () => {
    expect(isDealOverdue(baseDeal({ expectedCloseDate: '2026-06-14' }), NOW)).toBe(true);
    expect(isDealOverdue(baseDeal({ expectedCloseDate: '2026-06-15' }), NOW)).toBe(false);
    expect(isDealOverdue(baseDeal({ stage: 'won', expectedCloseDate: '2026-01-01' }), NOW)).toBe(false);
  });

  it('normalises comma-separated tags', () => {
    expect(normalizeTags(' Enterprise, multi year ,enterprise,, Pilot ')).toEqual(['enterprise', 'multi-year', 'pilot']);
  });
});

describe('task completion rules', () => {
  const task = (dueAt: Date, completedAt: string | null = null): Activity => ({
    id: 'a1',
    type: 'call',
    subject: 'Call',
    description: '',
    dueAt: dueAt.toISOString(),
    completedAt,
    priority: 'medium',
    ownerId: 'tm',
    contactId: null,
    dealId: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  });

  it('treats tasks due earlier today as due today, not overdue', () => {
    const earlier = task(new Date(2026, 5, 15, 9));
    expect(isActivityOverdue(earlier, NOW)).toBe(false);
    expect(activityBucket(earlier, NOW)).toBe('today');
  });

  it('buckets tasks by due date', () => {
    expect(activityBucket(task(new Date(2026, 5, 14, 9)), NOW)).toBe('overdue');
    expect(activityBucket(task(new Date(2026, 5, 18, 9)), NOW)).toBe('upcoming');
    expect(activityBucket(task(new Date(2026, 6, 30, 9)), NOW)).toBe('later');
    expect(activityBucket(task(new Date(2026, 5, 1), '2026-06-01T10:00:00.000Z'), NOW)).toBe('completed');
  });

  it('sets and clears completion timestamps', () => {
    const open = task(new Date(2026, 5, 16));
    expect(completionChange(open, true, NOW).completedAt).toBe(NOW.toISOString());
    expect(completionChange(open, false, NOW).completedAt).toBeNull();
  });
});
