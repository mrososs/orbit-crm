import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { Tooltip } from '../../shared/ui/tooltip';
import { ThemeService } from '../services/theme.service';
import { ViewportService } from '../services/viewport.service';
import { CommandPaletteService } from './command-palette.service';
import { LanguageSwitcher } from './language-switcher';
import { Logo } from './logo';
import { QuickCreate } from './quick-create';

@Component({
  selector: 'app-topbar',
  imports: [LucideDynamicIcon, TranslatePipe, Tooltip, LanguageSwitcher, QuickCreate, Logo],
  template: `
    <div class="flex h-full items-center gap-2 px-3 sm:px-5 lg:px-8">
      <button
        type="button"
        class="btn btn-ghost btn-icon lg:hidden"
        (click)="menu.emit()"
        [attr.aria-label]="'nav.openMenu' | translate"
        data-testid="mobile-menu"
      >
        <svg lucideIcon="menu" [size]="18" aria-hidden="true"></svg>
      </button>
      <div class="flex items-center gap-2 lg:hidden">
        <app-logo [size]="24" />
        <span class="text-sm font-semibold whitespace-nowrap text-fg">{{ 'app.name' | translate }}</span>
      </div>

      <button
        type="button"
        class="hidden h-9 w-full max-w-sm min-w-0 items-center gap-2.5 rounded-lg border border-line bg-surface px-3 text-start text-sm text-fg-subtle shadow-xs transition-colors hover:border-line-strong md:flex"
        (click)="palette.open()"
        data-testid="global-search"
      >
        <svg lucideIcon="search" [size]="15" aria-hidden="true"></svg>
        <span class="flex-1 truncate">{{ 'search.placeholder' | translate }}</span>
        <kbd class="kbd ltr-content">Ctrl K</kbd>
      </button>

      <div class="ms-auto flex items-center gap-1 sm:gap-1.5">
        <span
          class="me-1 hidden items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-fg-muted xl:inline-flex"
        >
          <span class="size-1.5 rounded-full bg-success" aria-hidden="true"></span>
          {{ 'demo.badge' | translate }}
        </span>
        <button
          type="button"
          class="btn btn-ghost btn-icon btn-sm md:hidden"
          (click)="palette.open()"
          [attr.aria-label]="'search.label' | translate"
        >
          <svg lucideIcon="search" [size]="17" aria-hidden="true"></svg>
        </button>
        <app-language-switcher [compact]="!viewport.isDesktop()" />
        <button
          type="button"
          class="btn btn-ghost btn-icon btn-sm"
          (click)="theme.toggle()"
          [uiTooltip]="(theme.isDark() ? 'theme.switchToLight' : 'theme.switchToDark') | translate"
          tooltipPosition="bottom"
          [attr.aria-label]="(theme.isDark() ? 'theme.switchToLight' : 'theme.switchToDark') | translate"
          data-testid="theme-toggle"
        >
          <svg [lucideIcon]="theme.isDark() ? 'sun' : 'moon'" [size]="17" aria-hidden="true"></svg>
        </button>
        <span class="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden="true"></span>
        <app-quick-create [compact]="viewport.isMobile()" />
      </div>
    </div>
  `,
  host: {
    class: 'sticky top-0 z-20 block h-[var(--topbar-height)] border-b border-line bg-canvas/85 backdrop-blur-md',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Topbar {
  protected readonly theme = inject(ThemeService);
  protected readonly palette = inject(CommandPaletteService);
  protected readonly viewport = inject(ViewportService);
  readonly menu = output<void>();
}
