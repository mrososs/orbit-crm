import { WORKSPACE_CURRENCY } from '../models';

/**
 * Locale-aware value formatting built on `Intl`. Translation (ngx-translate) and
 * formatting are separate concerns: these helpers never translate UI strings and
 * never convert currency — values are always shown in the workspace currency.
 */

const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>();

function memo<T extends Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>(
  key: string,
  create: () => T,
): T {
  let formatter = cache.get(key) as T | undefined;
  if (!formatter) {
    formatter = create();
    cache.set(key, formatter);
  }
  return formatter;
}

export function formatCurrency(
  value: number,
  locale: string,
  options: { compact?: boolean; currency?: string } = {},
): string {
  const currency = options.currency ?? WORKSPACE_CURRENCY;
  const key = `cur|${locale}|${currency}|${options.compact ? 'c' : 'f'}`;
  const formatter = memo(
    key,
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        // Compact figures (axes, hints) use the short symbol; full amounts keep the explicit one.
        currencyDisplay: options.compact ? 'narrowSymbol' : 'symbol',
        notation: options.compact ? 'compact' : 'standard',
        maximumFractionDigits: options.compact ? 1 : 0,
        minimumFractionDigits: 0,
      }),
  );
  if (!isRtlLocale(locale)) return formatter.format(value);
  if (options.compact) {
    // CLDR's Arabic compact form ("2.1 مليون US$") is too long for KPI tiles and
    // axes; the narrow "$" keeps the same currency with half the width.
    return `${formatNumber(value, locale, { compact: true })}\u00a0\u2068$\u2069`;
  }
  // In RTL text a Latin symbol such as "US$" is otherwise reordered to "$US";
  // a first-strong isolate keeps it intact.
  return formatter
    .formatToParts(value)
    .map((part) => (part.type === 'currency' ? `\u2068${part.value}\u2069` : part.value))
    .join('');
}

export function isRtlLocale(locale: string): boolean {
  return /^(ar|he|fa|ur)\b/i.test(locale);
}

export function formatNumber(value: number, locale: string, options: { compact?: boolean; decimals?: number } = {}): string {
  const key = `num|${locale}|${options.compact ? 'c' : 'f'}|${options.decimals ?? 'auto'}`;
  return memo(
    key,
    () =>
      new Intl.NumberFormat(locale, {
        notation: options.compact ? 'compact' : 'standard',
        maximumFractionDigits: options.decimals ?? (options.compact ? 1 : 0),
      }),
  ).format(value);
}

/** `ratio` is 0..1. */
export function formatPercent(ratio: number, locale: string, decimals = 0): string {
  return memo(
    `pct|${locale}|${decimals}`,
    () => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: decimals, minimumFractionDigits: 0 }),
  ).format(ratio);
}

/** Signed change in percentage points / percent, e.g. "+12%" or "−3.5 pts". */
export function formatSignedPercent(ratio: number, locale: string, decimals = 0): string {
  return memo(
    `spct|${locale}|${decimals}`,
    () =>
      new Intl.NumberFormat(locale, {
        style: 'percent',
        signDisplay: 'exceptZero',
        maximumFractionDigits: decimals,
      }),
  ).format(ratio);
}

export type DateStyle = 'short' | 'medium' | 'long' | 'monthYear' | 'month' | 'dayMonth' | 'weekday' | 'time' | 'dateTime';

const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { year: 'numeric', month: 'short', day: 'numeric' },
  medium: { year: 'numeric', month: 'short', day: 'numeric' },
  long: { year: 'numeric', month: 'long', day: 'numeric' },
  monthYear: { year: 'numeric', month: 'short' },
  month: { month: 'short' },
  dayMonth: { month: 'short', day: 'numeric' },
  weekday: { weekday: 'long', month: 'long', day: 'numeric' },
  time: { hour: 'numeric', minute: '2-digit' },
  dateTime: { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
};

export function formatDate(value: Date | string | number, locale: string, style: DateStyle = 'medium'): string {
  const date = value instanceof Date ? value : typeof value === 'string' && value.length === 10 ? parseLocalDate(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return memo(`date|${locale}|${style}`, () => new Intl.DateTimeFormat(locale, DATE_OPTIONS[style])).format(date);
}

/** Human relative time ("3 days ago", "in 2 hours") from `now`. */
export function formatRelative(value: Date | string, now: Date, locale: string): string {
  const date = value instanceof Date ? value : new Date(value);
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSeconds);
  const rtf = memo(`rel|${locale}`, () => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }));

  if (abs < 60) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(diffSeconds / 3600), 'hour');
  if (abs < 86_400 * 7) return rtf.format(Math.round(diffSeconds / 86_400), 'day');
  if (abs < 86_400 * 30) return rtf.format(Math.round(diffSeconds / (86_400 * 7)), 'week');
  if (abs < 86_400 * 365) return rtf.format(Math.round(diffSeconds / (86_400 * 30)), 'month');
  return rtf.format(Math.round(diffSeconds / (86_400 * 365)), 'year');
}

/** Calendar-day relative label: "today", "tomorrow", "in 3 days", "2 days ago". */
export function formatRelativeDay(value: Date | string, now: Date, locale: string): string {
  const date = value instanceof Date ? value : new Date(value);
  const a = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.round((a - b) / 86_400_000);
  const rtf = memo(`rel|${locale}`, () => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }));
  if (Math.abs(days) < 14) return rtf.format(days, 'day');
  return formatDate(date, locale, 'medium');
}

export function regionName(countryCode: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(countryCode) ?? countryCode;
  } catch {
    return countryCode;
  }
}

function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}
