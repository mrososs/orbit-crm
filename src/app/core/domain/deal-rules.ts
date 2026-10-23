import {
  Deal,
  DealStage,
  isOpenStage,
  OpenStage,
  STAGE_PROBABILITY,
  TimelineEventKind,
} from '../models';
import { parseIsoDate, startOfDay } from '../../shared/utils/date';

/**
 * Field changes produced by moving a deal to another stage. Closing a deal stamps
 * `closedAt` (revenue and win-rate are attributed to that date); reopening clears it.
 */
export function stageChange(deal: Deal, toStage: DealStage, now: Date): Partial<Deal> {
  if (deal.stage === toStage) return {};
  const timestamp = now.toISOString();
  const changes: Partial<Deal> = { stage: toStage, updatedAt: timestamp };

  if (toStage === 'won') {
    changes.closedAt = timestamp;
    changes.lostAtStage = null;
  } else if (toStage === 'lost') {
    changes.closedAt = timestamp;
    changes.lostAtStage = lastOpenStage(deal);
  } else {
    changes.closedAt = null;
    changes.lostAtStage = null;
  }
  return changes;
}

function lastOpenStage(deal: Deal): OpenStage {
  if (isOpenStage(deal.stage)) return deal.stage;
  if (deal.stage === 'won') return 'negotiation';
  return deal.lostAtStage ?? 'new';
}

export function stageEventKind(toStage: DealStage): TimelineEventKind {
  if (toStage === 'won') return 'deal-won';
  if (toStage === 'lost') return 'deal-lost';
  return 'deal-stage-changed';
}

export function dealProbability(deal: Pick<Deal, 'stage'>): number {
  return STAGE_PROBABILITY[deal.stage];
}

export function weightedValue(deal: Pick<Deal, 'stage' | 'value'>): number {
  return (deal.value * dealProbability(deal)) / 100;
}

export function isDealOpen(deal: Pick<Deal, 'stage'>): boolean {
  return isOpenStage(deal.stage);
}

/** An open deal whose expected close date has already passed. */
export function isDealOverdue(deal: Pick<Deal, 'stage' | 'expectedCloseDate'>, now: Date): boolean {
  return isOpenStage(deal.stage) && parseIsoDate(deal.expectedCloseDate) < startOfDay(now);
}

export function normalizeTags(raw: string): string[] {
  const seen = new Set<string>();
  return raw
    .split(',')
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, '-'))
    .filter((t) => t.length > 0 && !seen.has(t) && seen.add(t));
}
