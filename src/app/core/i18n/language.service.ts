import { Directionality } from '@angular/cdk/bidi';
import { computed, DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { InterpolationParameters, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { STORAGE } from '../services/platform';
import { formatNumber } from './locale.utils';
import {
  DEFAULT_LANGUAGE,
  LanguageDefinition,
  resolveLanguage,
  SUPPORTED_LANGUAGES,
} from './language.model';

export const LANGUAGE_STORAGE_KEY = 'orbit-crm.language';

const pluralCache = new Map<string, Intl.PluralRules>();
function pluralRules(code: string): Intl.PluralRules {
  let rules = pluralCache.get(code);
  if (!rules) {
    rules = new Intl.PluralRules(code);
    pluralCache.set(code, rules);
  }
  return rules;
}

/**
 * Single source of truth for the active language. Coordinates ngx-translate,
 * the document's `lang`/`dir`, CDK directionality (overlays, drag & drop) and
 * persistence. Components read its signals instead of subscribing to events.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly storage = inject(STORAGE);
  private readonly document = inject(DOCUMENT);
  private readonly directionality = inject(Directionality);

  private readonly _language = signal<LanguageDefinition>(resolveLanguage(DEFAULT_LANGUAGE));
  private readonly _switching = signal(false);

  readonly languages = SUPPORTED_LANGUAGES;
  readonly language = this._language.asReadonly();
  readonly code = computed(() => this._language().code);
  readonly locale = computed(() => this._language().locale);
  readonly direction = computed(() => this._language().dir);
  readonly isRtl = computed(() => this._language().dir === 'rtl');
  readonly switching = this._switching.asReadonly();

  /** Restores the persisted language (English when missing or unsupported). */
  async initialize(): Promise<void> {
    let stored: string | null;
    try {
      stored = this.storage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
      stored = null;
    }
    await this.use(stored ?? DEFAULT_LANGUAGE);
  }

  /**
   * Loads the dictionary first, then flips the UI in one step — the interface
   * never shows raw keys. Application state is untouched.
   */
  async use(code: string): Promise<void> {
    const language = resolveLanguage(code);
    this._switching.set(true);
    try {
      await firstValueFrom(this.translate.use(language.code));
    } catch (error) {
      console.error(`[Orbit CRM] Could not load "${language.code}" translations`, error);
      if (language.code !== DEFAULT_LANGUAGE) {
        this._switching.set(false);
        return this.use(DEFAULT_LANGUAGE);
      }
    }
    this._language.set(language);
    this.applyToDocument(language);
    try {
      this.storage.setItem(LANGUAGE_STORAGE_KEY, language.code);
    } catch {
      // Storage unavailable — the choice still applies for this session.
    }
    this._switching.set(false);
  }

  /**
   * Reactive translation for TypeScript code (charts, toasts, titles). Reading it
   * inside `computed`/`effect` re-evaluates when the language changes.
   */
  t(key: string, params?: InterpolationParameters): string {
    this._language();
    return this.translate.instant(key, params) as string;
  }

  /**
   * Plural-aware translation. Dictionary entries are objects keyed by CLDR plural
   * category (`one`, `other`; Arabic adds `zero`, `two`, `few`, `many`), selected
   * with `Intl.PluralRules` for the active language. `{{count}}` is locale-formatted.
   */
  plural(key: string, count: number, params: InterpolationParameters = {}): string {
    const language = this._language();
    const category = pluralRules(language.code).select(count);
    const values = { ...params, count: formatNumber(count, language.locale) };
    const exact = `${key}.${category}`;
    const translated = this.translate.instant(exact, values) as string;
    return translated !== exact ? translated : (this.translate.instant(`${key}.other`, values) as string);
  }

  private applyToDocument(language: LanguageDefinition): void {
    const html = this.document.documentElement;
    html.lang = language.code;
    html.dir = language.dir;
    if (this.directionality.value !== language.dir) {
      this.directionality.valueSignal.set(language.dir);
      this.directionality.change.emit(language.dir);
    }
  }
}
