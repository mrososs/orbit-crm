import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InterpolationParameters, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { templateParts } from '../utils/text';

export interface RichSlot {
  text: string;
  link?: string | null;
  strong?: boolean;
}

/**
 * Renders a translated sentence whose placeholders become styled or linked
 * fragments — word order stays under the translator's control (no string
 * concatenation), and user data is rendered as text, never HTML.
 */
@Component({
  selector: 'ui-rich-text',
  imports: [RouterLink],
  template: `
    @for (part of parts(); track $index) {
      @if (part.slot; as name) {
        @let slot = slots()[name];
        @if (slot?.link) {
          <a [routerLink]="slot!.link" class="font-medium text-fg hover:text-primary hover:underline"><bdi>{{ slot!.text }}</bdi></a>
        } @else if (slot) {
          <bdi [class.font-medium]="slot.strong !== false" [class.text-fg]="slot.strong !== false">{{ slot.text }}</bdi>
        }
      } @else {
        {{ part.text }}
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RichText {
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);

  readonly key = input.required<string>();
  readonly slots = input<Record<string, RichSlot>>({});
  /** Plain (non-slot) interpolation values. */
  readonly params = input<InterpolationParameters>({});

  protected readonly parts = computed(() => {
    this.language.code();
    const slotNames = Object.keys(this.slots());
    // Interpolate plain params, leave slot placeholders intact for rendering.
    const keep = Object.fromEntries(slotNames.map((name) => [name, `{{${name}}}`]));
    const template = this.translate.instant(this.key(), { ...this.params(), ...keep }) as string;
    return templateParts(template);
  });
}
