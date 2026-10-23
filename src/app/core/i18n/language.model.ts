export type Direction = 'ltr' | 'rtl';

export interface LanguageDefinition {
  /** ngx-translate dictionary id and `<html lang>` value. */
  code: string;
  /** Name of the language in that language — shown in selectors. */
  nativeName: string;
  /** English name, for accessibility and docs. */
  englishName: string;
  dir: Direction;
  /**
   * BCP 47 tag used for Intl formatting. Arabic pins the Gregorian calendar and
   * Latin digits so dates and figures match the rest of the workspace data.
   */
  locale: string;
}

/** Add a language here and ship `public/i18n/<code>.json` — nothing else changes. */
export const SUPPORTED_LANGUAGES: readonly LanguageDefinition[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', dir: 'ltr', locale: 'en-US' },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl', locale: 'ar-SA-u-ca-gregory-nu-latn' },
  { code: 'fr', nativeName: 'Français', englishName: 'French', dir: 'ltr', locale: 'fr-FR' },
];

export const DEFAULT_LANGUAGE = 'en';

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export function findLanguage(code: string | null | undefined): LanguageDefinition | undefined {
  if (!code) return undefined;
  const normalized = code.toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LANGUAGES.find((l) => l.code === normalized);
}

export function resolveLanguage(code: string | null | undefined): LanguageDefinition {
  return findLanguage(code) ?? SUPPORTED_LANGUAGES.find((l) => l.code === DEFAULT_LANGUAGE)!;
}
