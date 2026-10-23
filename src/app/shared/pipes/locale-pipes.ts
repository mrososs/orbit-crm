import { inject, Pipe, PipeTransform } from '@angular/core';
import { LanguageService } from '../../core/i18n/language.service';
import {
  DateStyle,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  formatRelative,
  formatRelativeDay,
  regionName,
} from '../../core/i18n/locale.utils';
import { CLOCK } from '../../core/services/platform';

/*
 * Locale-aware formatting pipes. They read the active locale signal, so they are
 * impure (re-run on change detection) — cheap because Intl formatters are cached.
 */

@Pipe({ name: 'money', pure: false })
export class MoneyPipe implements PipeTransform {
  private readonly language = inject(LanguageService);
  transform(value: number | null | undefined, mode: 'full' | 'compact' = 'full'): string {
    if (value === null || value === undefined) return '—';
    return formatCurrency(value, this.language.locale(), { compact: mode === 'compact' });
  }
}

@Pipe({ name: 'num', pure: false })
export class NumberPipe implements PipeTransform {
  private readonly language = inject(LanguageService);
  transform(value: number | null | undefined, mode: 'full' | 'compact' = 'full', decimals?: number): string {
    if (value === null || value === undefined) return '—';
    return formatNumber(value, this.language.locale(), { compact: mode === 'compact', decimals });
  }
}

@Pipe({ name: 'pct', pure: false })
export class PercentPipe implements PipeTransform {
  private readonly language = inject(LanguageService);
  /** `ratio` is 0..1. */
  transform(ratio: number | null | undefined, decimals = 0): string {
    if (ratio === null || ratio === undefined) return '—';
    return formatPercent(ratio, this.language.locale(), decimals);
  }
}

@Pipe({ name: 'localDate', pure: false })
export class LocalDatePipe implements PipeTransform {
  private readonly language = inject(LanguageService);
  transform(value: string | Date | null | undefined, style: DateStyle = 'medium'): string {
    if (!value) return '—';
    return formatDate(value, this.language.locale(), style);
  }
}

@Pipe({ name: 'relativeTime', pure: false })
export class RelativeTimePipe implements PipeTransform {
  private readonly language = inject(LanguageService);
  private readonly clock = inject(CLOCK);
  transform(value: string | Date | null | undefined): string {
    if (!value) return '—';
    return formatRelative(value, this.clock(), this.language.locale());
  }
}

@Pipe({ name: 'relativeDay', pure: false })
export class RelativeDayPipe implements PipeTransform {
  private readonly language = inject(LanguageService);
  private readonly clock = inject(CLOCK);
  transform(value: string | Date | null | undefined): string {
    if (!value) return '—';
    return formatRelativeDay(value, this.clock(), this.language.locale());
  }
}

@Pipe({ name: 'region', pure: false })
export class RegionPipe implements PipeTransform {
  private readonly language = inject(LanguageService);
  transform(countryCode: string | null | undefined): string {
    if (!countryCode) return '—';
    return regionName(countryCode, this.language.locale());
  }
}

export const LOCALE_PIPES = [
  MoneyPipe,
  NumberPipe,
  PercentPipe,
  LocalDatePipe,
  RelativeTimePipe,
  RelativeDayPipe,
  RegionPipe,
] as const;
