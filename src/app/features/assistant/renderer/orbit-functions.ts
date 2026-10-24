import { computed } from '@angular/core';
import { createFunctionImplementation, FunctionImplementation } from '@a2ui/web_core/v0_9';
import { z } from 'zod';
import { LanguageService } from '../../../core/i18n/language.service';
import { DateStyle, formatCurrency, formatDate, formatNumber, formatPercent, formatRelativeDay } from '../../../core/i18n/locale.utils';
import { TranslationKeySchema } from '../schemas/a2ui.schemas';

/**
 * Client-side A2UI functions of the Orbit catalog. Payloads reference them as
 * `{ "call": "formatCurrency", "args": { "value": { "path": "/kpis/revenue" } } }`.
 *
 * Each returns an Angular `computed` that reads the active language, so
 * rendered surfaces re-localize instantly when the visitor switches language.
 * Arguments were already checked by the boundary schemas; the implementations
 * still guard their inputs because they run on resolved data-model values.
 */
export function createOrbitFunctions(language: LanguageService, now: () => Date): FunctionImplementation[] {
  const translationKey = (value: unknown) => {
    const parsed = TranslationKeySchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  };
  const params = (value: unknown): Record<string, string | number> => {
    const out: Record<string, string | number> = {};
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) if (typeof v === 'string' || typeof v === 'number') out[k] = v;
    }
    return out;
  };
  const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
  const asString = <T>(signal: T) => signal as unknown as string;

  return [
    createFunctionImplementation(
      { name: 't', returnType: 'string', schema: z.object({ key: z.any(), params: z.any().optional() }), description: 'Translates an Orbit translation key.' },
      (args) =>
        asString(
          computed(() => {
            const key = translationKey(args.key);
            return key ? language.t(key, params(args.params)) : '';
          }),
        ),
    ),
    createFunctionImplementation(
      {
        name: 'plural',
        returnType: 'string',
        schema: z.object({ key: z.any(), count: z.any(), params: z.any().optional() }),
        description: 'Plural-aware translation (Intl.PluralRules for the active language).',
      },
      (args) =>
        asString(
          computed(() => {
            const key = translationKey(args.key);
            const count = num(args.count);
            return key && count !== null ? language.plural(key, count, params(args.params)) : '';
          }),
        ),
    ),
    createFunctionImplementation(
      { name: 'formatCurrency', returnType: 'string', schema: z.object({ value: z.any(), compact: z.any().optional() }), description: 'Workspace currency, locale-formatted.' },
      (args) =>
        asString(
          computed(() => {
            const value = num(args.value);
            return value === null ? '—' : formatCurrency(value, language.locale(), { compact: args.compact === true });
          }),
        ),
    ),
    createFunctionImplementation(
      { name: 'formatNumber', returnType: 'string', schema: z.object({ value: z.any(), compact: z.any().optional() }), description: 'Locale-formatted number.' },
      (args) =>
        asString(
          computed(() => {
            const value = num(args.value);
            return value === null ? '—' : formatNumber(value, language.locale(), { compact: args.compact === true });
          }),
        ),
    ),
    createFunctionImplementation(
      { name: 'formatPercent', returnType: 'string', schema: z.object({ value: z.any(), decimals: z.any().optional() }), description: 'Ratio (0..1) as a locale-formatted percentage.' },
      (args) =>
        asString(
          computed(() => {
            const value = num(args.value);
            return value === null ? '—' : formatPercent(value, language.locale(), typeof args.decimals === 'number' ? args.decimals : 0);
          }),
        ),
    ),
    createFunctionImplementation(
      { name: 'formatDate', returnType: 'string', schema: z.object({ value: z.any(), style: z.any().optional() }), description: 'Locale-formatted date or relative day.' },
      (args) =>
        asString(
          computed(() => {
            if (typeof args.value !== 'string' || !args.value) return '';
            const locale = language.locale();
            if (args.style === 'relativeDay') return formatRelativeDay(args.value, now(), locale);
            const style: DateStyle = ['medium', 'long', 'full', 'dayMonth', 'dateTime'].includes(args.style as string) ? (args.style as DateStyle) : 'medium';
            return formatDate(args.value, locale, style);
          }),
        ),
    ),
  ];
}
