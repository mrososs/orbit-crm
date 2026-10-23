import { RangePreset } from '../services/preferences.service';
import {
  addDays,
  addMonths,
  DAY_MS,
  endOfDay,
  parseIsoDate,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  toIsoDate,
} from '../../shared/utils/date';

/** Inclusive date range. */
export interface DateRange {
  start: Date;
  end: Date;
}

export type Granularity = 'week' | 'month';

export interface Bucket {
  key: string;
  start: Date;
  end: Date;
}

export const RANGE_PRESETS: readonly Exclude<RangePreset, 'custom'>[] = ['last30', 'last90', 'last6m', 'last12m', 'ytd'];

export function resolveRange(
  preset: RangePreset,
  now: Date,
  custom?: { start: string; end: string },
): DateRange {
  const end = endOfDay(now);
  switch (preset) {
    case 'last30':
      return { start: startOfDay(addDays(now, -29)), end };
    case 'last90':
      return { start: startOfDay(addDays(now, -89)), end };
    case 'last6m':
      return { start: startOfMonth(addMonths(now, -5)), end };
    case 'last12m':
      return { start: startOfMonth(addMonths(now, -11)), end };
    case 'ytd':
      return { start: startOfYear(now), end };
    case 'custom': {
      if (!custom) return { start: startOfDay(addDays(now, -29)), end };
      const a = parseIsoDate(custom.start);
      const b = parseIsoDate(custom.end);
      const [s, e] = a <= b ? [a, b] : [b, a];
      return { start: startOfDay(s), end: endOfDay(e) };
    }
  }
}

/** The immediately preceding period of identical length — used for comparisons. */
export function previousRange(range: DateRange): DateRange {
  const duration = range.end.getTime() - range.start.getTime();
  const end = new Date(range.start.getTime() - 1);
  return { start: new Date(end.getTime() - duration), end };
}

export function rangeDuration(range: DateRange): number {
  return range.end.getTime() - range.start.getTime() + 1;
}

export function rangeDays(range: DateRange): number {
  return Math.round(rangeDuration(range) / DAY_MS);
}

export function inRange(value: string | null | undefined, range: DateRange): boolean {
  if (!value) return false;
  const t = new Date(value).getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

export function granularityFor(range: DateRange): Granularity {
  return rangeDays(range) <= 92 ? 'week' : 'month';
}

/** Calendar buckets covering the range (first/last may be partial). */
export function buildBuckets(range: DateRange, granularity: Granularity): Bucket[] {
  const buckets: Bucket[] = [];
  let cursor = granularity === 'week' ? startOfWeek(range.start) : startOfMonth(range.start);
  while (cursor <= range.end) {
    const next = granularity === 'week' ? addDays(cursor, 7) : addMonths(cursor, 1);
    buckets.push({
      key: toIsoDate(cursor),
      start: new Date(Math.max(cursor.getTime(), range.start.getTime())),
      end: new Date(Math.min(next.getTime() - 1, range.end.getTime())),
    });
    cursor = next;
  }
  return buckets;
}

export function bucketIndex(buckets: readonly Bucket[], date: Date): number {
  const t = date.getTime();
  return buckets.findIndex((b) => t >= b.start.getTime() && t <= b.end.getTime());
}

export function toRangeInputs(range: DateRange): { start: string; end: string } {
  return { start: toIsoDate(range.start), end: toIsoDate(range.end) };
}
