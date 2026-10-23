import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideRouter,
  TitleStrategy,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { routes } from './app.routes';
import { DEFAULT_LANGUAGE } from './core/i18n/language.model';
import { LanguageService } from './core/i18n/language.service';
import { TranslatedTitleStrategy } from './core/i18n/translated-title.strategy';
import { provideAppIcons } from './core/icons';
import { provideLocalRepositories } from './core/repositories/local-repositories';
import { ThemeService } from './core/services/theme.service';
import { WorkspaceService } from './state/workspace.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions({ skipInitialTransition: true }),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
    provideHttpClient(withFetch()),
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: 'i18n/', suffix: '.json' }),
      fallbackLang: DEFAULT_LANGUAGE,
    }),
    provideLocalRepositories(),
    provideAppIcons(),
    // Theme is applied before first paint; translations load before bootstrap
    // completes so raw keys are never rendered. Workspace data hydrates in the
    // background behind skeleton states.
    provideAppInitializer(() => {
      inject(ThemeService);
      inject(WorkspaceService)
        .initialize()
        .catch((error) => console.error('[Orbit CRM] Workspace failed to load', error));
      return inject(LanguageService).initialize();
    }),
  ],
};
