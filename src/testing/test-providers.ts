import { EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateLoader, provideTranslateService, TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import ar from '../../public/i18n/ar.json';
import en from '../../public/i18n/en.json';
import fr from '../../public/i18n/fr.json';
import { LanguageService } from '../app/core/i18n/language.service';
import { provideAppIcons } from '../app/core/icons';
import { provideLocalRepositories } from '../app/core/repositories/local-repositories';
import { CLOCK, MemoryStorage, MOCK_LATENCY, STORAGE } from '../app/core/services/platform';
import { WorkspaceService } from '../app/state/workspace.service';

export const DICTIONARIES: Record<string, TranslationObject> = { en, ar, fr } as Record<string, TranslationObject>;

/** Fixed "now" for deterministic tests: Monday 15 June 2026, 12:00 local time. */
export const TEST_NOW = new Date(2026, 5, 15, 12, 0, 0);

class StaticTranslateLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<TranslationObject> {
    return of(DICTIONARIES[lang] ?? {});
  }
}

export interface TestEnvironmentOptions {
  storage?: Storage;
  now?: Date;
}

/** Providers for an isolated, synchronous, in-memory Orbit environment. */
export function provideTestEnvironment(options: TestEnvironmentOptions = {}): (Provider | EnvironmentProviders)[] {
  const now = options.now ?? TEST_NOW;
  return [
    { provide: STORAGE, useValue: options.storage ?? new MemoryStorage() },
    { provide: CLOCK, useValue: () => new Date(now) },
    { provide: MOCK_LATENCY, useValue: { read: 0, write: 0 } },
    provideLocalRepositories(),
    provideAppIcons(),
    provideTranslateService({ loader: provideTranslateLoader(StaticTranslateLoader), fallbackLang: 'en' }),
  ];
}

/** Configures TestBed and hydrates the workspace + translations. */
export async function setupWorkspace(
  options: TestEnvironmentOptions = {},
  extraProviders: (Provider | EnvironmentProviders)[] = [],
): Promise<void> {
  TestBed.configureTestingModule({ providers: [...provideTestEnvironment(options), ...extraProviders] });
  await TestBed.inject(LanguageService).initialize();
  await TestBed.inject(WorkspaceService).initialize();
}
