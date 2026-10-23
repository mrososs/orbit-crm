import { computed, DOCUMENT, effect, inject, Injectable, signal } from '@angular/core';
import { PreferencesService } from './preferences.service';

/** Applies the theme preference to `<html>` and exposes the resolved theme. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly prefs = inject(PreferencesService);
  private readonly document = inject(DOCUMENT);
  private readonly systemDark = signal(false);

  readonly resolved = computed<'light' | 'dark'>(() => {
    const pref = this.prefs.theme();
    if (pref === 'system') return this.systemDark() ? 'dark' : 'light';
    return pref;
  });
  readonly isDark = computed(() => this.resolved() === 'dark');

  constructor() {
    const media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
    if (media) {
      this.systemDark.set(media.matches);
      media.addEventListener('change', (e) => this.systemDark.set(e.matches));
    }

    effect(() => {
      const html = this.document.documentElement;
      html.classList.toggle('dark', this.isDark());
      html.classList.toggle('reduce-motion', this.prefs.reduceMotion());
    });
  }

  toggle(): void {
    this.prefs.set('theme', this.isDark() ? 'light' : 'dark');
  }
}
