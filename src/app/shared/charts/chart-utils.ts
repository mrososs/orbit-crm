import { Bucket, Granularity } from '../../core/analytics/date-range';
import { formatCurrency, formatDate, formatNumber, formatPercent } from '../../core/i18n/locale.utils';

/** Adds alpha to a #rrggbb color. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Short axis label for a time bucket. */
export function bucketAxisLabel(bucket: Bucket, granularity: Granularity, locale: string): string {
  const anchor = new Date(bucket.key + 'T00:00:00');
  return granularity === 'month' ? formatDate(anchor, locale, 'month') : formatDate(anchor, locale, 'dayMonth');
}

/** Long label for tooltips. Week labels are produced by the caller (translated). */
export function bucketLongLabel(bucket: Bucket, granularity: Granularity, locale: string): string {
  const anchor = new Date(bucket.key + 'T00:00:00');
  return granularity === 'month' ? formatDate(anchor, locale, 'monthYear') : formatDate(anchor, locale, 'medium');
}

export interface Formatters {
  money: (value: number) => string;
  moneyCompact: (value: number) => string;
  number: (value: number) => string;
  percent: (value: number) => string;
}

export function createFormatters(locale: string): Formatters {
  return {
    money: (v) => formatCurrency(v, locale),
    moneyCompact: (v) => formatCurrency(v, locale, { compact: true }),
    number: (v) => formatNumber(v, locale),
    percent: (v) => formatPercent(v, locale),
  };
}
