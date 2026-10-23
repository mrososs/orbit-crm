import { effect, inject, Injectable, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { LanguageService } from './language.service';

/**
 * Route `title` values are translation keys. The document title follows both
 * navigation and language switches.
 */
@Injectable({ providedIn: 'root' })
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly language = inject(LanguageService);
  private readonly key = signal<string | undefined>(undefined);

  constructor() {
    super();
    effect(() => {
      const key = this.key();
      const product = this.language.t('app.name');
      this.title.setTitle(key ? `${this.language.t(key)} · ${product}` : product);
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.key.set(this.buildTitle(snapshot));
  }
}
