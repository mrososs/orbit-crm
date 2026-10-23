import { Directionality } from '@angular/cdk/bidi';
import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { DICTIONARIES, provideTestEnvironment, setupWorkspace } from '../../../testing/test-providers';
import { MemoryStorage } from '../services/platform';
import { CrmService } from '../../state/crm.service';
import { DealsStore } from '../../state/entity-stores';
import { findLanguage, resolveLanguage } from './language.model';
import { LANGUAGE_STORAGE_KEY, LanguageService } from './language.service';
import { formatCurrency, formatDate, formatPercent } from './locale.utils';

const PLURAL = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);

function leafKeys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const isPlural = typeof value === 'object' && Object.keys(value).every((k) => PLURAL.has(k));
    return typeof value === 'string' || isPlural ? [path] : leafKeys(value as object, path);
  });
}

describe('translation dictionaries', () => {
  const en = leafKeys(DICTIONARIES['en']).sort();

  it.each(['ar', 'fr'])('%s has exactly the same keys as English', (lang) => {
    expect(leafKeys(DICTIONARIES[lang]).sort()).toEqual(en);
  });

  it('provides every Arabic plural category for count messages', () => {
    const arCounts = (DICTIONARIES['ar']['charts'] as Record<string, Record<string, string>>)['dealsCount'];
    expect(Object.keys(arCounts).sort()).toEqual(['few', 'many', 'one', 'other', 'two', 'zero']);
  });
});

describe('language model', () => {
  it('resolves supported languages and region variants', () => {
    expect(findLanguage('fr-CA')?.code).toBe('fr');
    expect(resolveLanguage('ar').dir).toBe('rtl');
  });

  it('falls back to English for unsupported languages', () => {
    expect(resolveLanguage('de').code).toBe('en');
    expect(resolveLanguage(null).code).toBe('en');
  });
});

describe('LanguageService', () => {
  let storage: MemoryStorage;

  function init(): LanguageService {
    TestBed.configureTestingModule({ providers: provideTestEnvironment({ storage }) });
    return TestBed.inject(LanguageService);
  }

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('loads English by default', async () => {
    const language = init();
    await language.initialize();
    expect(language.code()).toBe('en');
    expect(TestBed.inject(DOCUMENT).documentElement.lang).toBe('en');
    expect(language.t('nav.dashboard')).toBe('Dashboard');
  });

  it('switches to Arabic with RTL direction and persists the choice', async () => {
    const language = init();
    await language.initialize();
    await language.use('ar');

    const html = TestBed.inject(DOCUMENT).documentElement;
    expect(html.dir).toBe('rtl');
    expect(html.lang).toBe('ar');
    expect(TestBed.inject(Directionality).value).toBe('rtl');
    expect(storage.getItem(LANGUAGE_STORAGE_KEY)).toBe('ar');
    expect(language.t('nav.dashboard')).toBe('لوحة التحكم');
  });

  it('restores LTR when switching to French', async () => {
    const language = init();
    await language.use('ar');
    await language.use('fr');
    expect(TestBed.inject(DOCUMENT).documentElement.dir).toBe('ltr');
    expect(language.t('nav.settings')).toBe('Paramètres');
  });

  it('restores the persisted language on startup and ignores unsupported values', async () => {
    storage.setItem(LANGUAGE_STORAGE_KEY, 'fr');
    const language = init();
    await language.initialize();
    expect(language.code()).toBe('fr');

    TestBed.resetTestingModule();
    storage.setItem(LANGUAGE_STORAGE_KEY, 'xx');
    const fallback = init();
    await fallback.initialize();
    expect(fallback.code()).toBe('en');
  });

  it('selects CLDR plural forms per language', async () => {
    const language = init();
    await language.use('en');
    expect(language.plural('charts.dealsCount', 1)).toBe('1 deal');
    expect(language.plural('charts.dealsCount', 5)).toBe('5 deals');

    await language.use('ar');
    expect(language.plural('charts.dealsCount', 0)).toBe('لا توجد صفقات');
    expect(language.plural('charts.dealsCount', 2)).toBe('صفقتان');
    expect(language.plural('charts.dealsCount', 5)).toBe('5 صفقات');
    expect(language.plural('charts.dealsCount', 25)).toBe('25 صفقة');

    await language.use('fr');
    expect(language.plural('charts.dealsCount', 1)).toBe('1 affaire');
    expect(language.plural('charts.dealsCount', 1200)).toBe('1\u202f200 affaires');
  });

  it('interpolates parameters without concatenation', async () => {
    const language = init();
    await language.use('fr');
    expect(language.t('ranges.comparedWith', { start: 'A', end: 'B' })).toBe('Comparé à la période du A au B');
  });
});

describe('locale formatting', () => {
  it('formats the workspace currency per locale without converting values', () => {
    expect(formatCurrency(12_500, 'en-US')).toBe('$12,500');
    expect(formatCurrency(12_500, 'fr-FR')).toMatch(/^12\s500\s\$US$/);
    expect(formatCurrency(12_500, resolveLanguage('ar').locale)).toContain('12,500');
  });

  it('keeps Gregorian dates and Latin digits for Arabic', () => {
    const value = formatDate(new Date(2026, 5, 15), resolveLanguage('ar').locale, 'long');
    expect(value).toContain('2026');
    expect(value).toContain('15');
    expect(formatPercent(0.42, resolveLanguage('ar').locale)).toContain('42');
  });
});

describe('language switching and application state', () => {
  it('does not modify CRM records or monetary values', async () => {
    await setupWorkspace();
    const deals = TestBed.inject(DealsStore);
    const before = JSON.stringify(deals.entities());
    const language = TestBed.inject(LanguageService);
    await language.use('ar');
    await language.use('fr');
    expect(JSON.stringify(deals.entities())).toBe(before);
    expect(TestBed.inject(TranslateService).getCurrentLang()).toBe('fr');
    expect(TestBed.inject(CrmService)).toBeTruthy();
  });
});
