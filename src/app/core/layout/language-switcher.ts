import { CdkMenu, CdkMenuItemRadio, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../i18n/language.service';

/** Top-bar language menu — switches instantly without reloading or losing state. */
@Component({
  selector: 'app-language-switcher',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItemRadio, LucideDynamicIcon, TranslatePipe],
  template: `
    <button
      type="button"
      class="btn btn-ghost btn-sm gap-1.5 px-2"
      [cdkMenuTriggerFor]="menu"
      [attr.aria-label]="'language.change' | translate"
      data-testid="language-switcher"
    >
      <svg lucideIcon="languages" [size]="16" aria-hidden="true"></svg>
      @if (!compact()) {
        <span class="text-[0.8125rem] font-medium text-fg">{{ language.language().nativeName }}</span>
      }
      <svg lucideIcon="chevron-down" [size]="13" class="text-fg-subtle" aria-hidden="true"></svg>
    </button>

    <ng-template #menu>
      <div cdkMenu class="menu-panel w-52" [attr.aria-label]="'language.label' | translate">
        <p class="menu-label">{{ 'language.label' | translate }}</p>
        @for (lang of language.languages; track lang.code) {
          <button
            cdkMenuItemRadio
            class="menu-item"
            [cdkMenuItemChecked]="language.code() === lang.code"
            (cdkMenuItemTriggered)="language.use(lang.code)"
            [attr.lang]="lang.code"
            [attr.data-testid]="'language-option-' + lang.code"
          >
            <span
              class="flex h-5 w-7 items-center justify-center rounded border border-line bg-surface-sunken text-2xs font-semibold text-fg-muted uppercase"
              aria-hidden="true"
              >{{ lang.code }}</span
            >
            <span class="flex-1">{{ lang.nativeName }}</span>
            @if (language.code() === lang.code) {
              <svg lucideIcon="check" [size]="15" class="text-primary" aria-hidden="true"></svg>
            }
          </button>
        }
      </div>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageSwitcher {
  protected readonly language = inject(LanguageService);
  readonly compact = input(false);
}
