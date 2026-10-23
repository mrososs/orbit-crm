import { inject, Pipe, PipeTransform } from '@angular/core';
import { InterpolationParameters } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';

/** `{{ 'charts.dealsCount' | plural: count }}` — CLDR plural selection per language. */
@Pipe({ name: 'plural', pure: false })
export class PluralPipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(key: string, count: number, params?: InterpolationParameters): string {
    return this.language.plural(key, count, params);
  }
}
