import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { PluralPipe } from '../../shared/pipes/plural.pipe';
import { Avatar } from '../../shared/ui/avatar';
import { ActivitiesStore, TeamStore } from '../../state/entity-stores';
import { isActivityOverdue } from '../domain/activity-rules';
import { fullName } from '../models';
import { CLOCK } from '../services/platform';
import { CURRENT_USER_ID } from '../services/session';
import { CommandPaletteService } from './command-palette.service';
import { Logo } from './logo';
import { INSIGHT_NAV, PRIMARY_NAV, SETTINGS_NAV } from './nav-items';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, LucideDynamicIcon, TranslatePipe, PluralPipe, Logo, Avatar],
  template: `
    <div class="flex h-[var(--topbar-height)] shrink-0 items-center gap-2.5 px-4">
      <app-logo [size]="28" />
      <div class="min-w-0 leading-tight">
        <p class="text-[0.9375rem] font-semibold tracking-[-0.01em] text-fg">{{ 'app.name' | translate }}</p>
        <p class="truncate text-2xs font-medium text-fg-subtle">{{ 'app.workspace' | translate }}</p>
      </div>
    </div>

    <div class="px-3 pt-1 pb-2">
      <button
        type="button"
        class="flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-surface-sunken px-2.5 text-start text-[0.8125rem] text-fg-subtle transition-colors hover:border-line-strong hover:text-fg-muted"
        (click)="palette.open(); navigate.emit()"
      >
        <svg lucideIcon="search" [size]="15" aria-hidden="true"></svg>
        <span class="flex-1 truncate">{{ 'search.placeholderShort' | translate }}</span>
        <kbd class="kbd ltr-content">⌘K</kbd>
      </button>
    </div>

    <nav class="flex-1 overflow-y-auto px-3 pb-3" [attr.aria-label]="'nav.main' | translate">
      <p class="px-2.5 pt-3 pb-1.5 text-2xs font-semibold tracking-wider text-fg-subtle uppercase">
        {{ 'nav.sectionWorkspace' | translate }}
      </p>
      <ul class="flex flex-col gap-0.5">
        @for (item of primary; track item.path) {
          <li>
            <a
              [routerLink]="item.path"
              routerLinkActive="is-active"
              #rla="routerLinkActive"
              [attr.aria-current]="rla.isActive ? 'page' : null"
              class="nav-link"
              (click)="navigate.emit()"
            >
              <svg [lucideIcon]="item.icon" [size]="16" aria-hidden="true"></svg>
              <span class="flex-1 truncate">{{ item.label | translate }}</span>
              @if (item.path === '/activities' && overdue() > 0) {
                <span
                  class="rounded-full bg-danger-soft px-1.5 text-2xs leading-4.5 font-semibold text-danger-soft-fg tabular"
                  [attr.aria-label]="'nav.overdueCount' | plural: overdue()"
                  >{{ overdue() }}</span
                >
              }
            </a>
          </li>
        }
      </ul>

      <p class="px-2.5 pt-5 pb-1.5 text-2xs font-semibold tracking-wider text-fg-subtle uppercase">
        {{ 'nav.sectionInsights' | translate }}
      </p>
      <ul class="flex flex-col gap-0.5">
        @for (item of insights; track item.path) {
          <li>
            <a
              [routerLink]="item.path"
              routerLinkActive="is-active"
              #rla="routerLinkActive"
              [attr.aria-current]="rla.isActive ? 'page' : null"
              class="nav-link"
              (click)="navigate.emit()"
            >
              <svg [lucideIcon]="item.icon" [size]="16" aria-hidden="true"></svg>
              <span class="flex-1 truncate">{{ item.label | translate }}</span>
            </a>
          </li>
        }
        <li>
          <a
            [routerLink]="settingsItem.path"
            routerLinkActive="is-active"
            #rls="routerLinkActive"
            [attr.aria-current]="rls.isActive ? 'page' : null"
            class="nav-link"
            (click)="navigate.emit()"
          >
            <svg [lucideIcon]="settingsItem.icon" [size]="16" aria-hidden="true"></svg>
            <span class="flex-1 truncate">{{ settingsItem.label | translate }}</span>
          </a>
        </li>
      </ul>
    </nav>

    <div class="border-t border-line-subtle p-3">
      <div class="rounded-xl border border-primary-border/60 bg-primary-soft/60 p-3">
        <p class="flex items-center gap-1.5 text-xs font-semibold text-primary-soft-fg">
          <svg lucideIcon="sparkles" [size]="13" aria-hidden="true"></svg>
          {{ 'demo.badge' | translate }}
        </p>
        <p class="mt-1 text-xs leading-relaxed text-fg-muted">{{ 'demo.sidebarNote' | translate }}</p>
        <a
          routerLink="/settings"
          fragment="demo-data"
          class="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-soft-fg hover:underline"
          (click)="navigate.emit()"
        >
          {{ 'demo.manage' | translate }}
          <svg lucideIcon="arrow-right" [size]="12" class="rtl-flip" aria-hidden="true"></svg>
        </a>
      </div>

      @if (user(); as u) {
        <div class="mt-3 flex items-center gap-2.5 px-1">
          <ui-avatar [name]="u.name" size="md" />
          <div class="min-w-0 leading-tight">
            <p class="truncate text-[0.8125rem] font-medium text-fg">{{ u.name }}</p>
            <p class="truncate text-xs text-fg-subtle">{{ 'enums.role.' + u.role | translate }}</p>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      height: 2.125rem;
      padding-inline: 0.625rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--fg-muted);
      transition:
        background-color 140ms ease,
        color 140ms ease;
    }
    .nav-link:hover {
      background: var(--surface-hover);
      color: var(--fg);
    }
    .nav-link.is-active {
      background: var(--surface-active);
      color: var(--fg);
      box-shadow: inset 0 0 0 1px var(--border-subtle);
    }
    .nav-link.is-active svg {
      color: var(--primary);
    }
  `,
  host: { class: 'flex h-full w-full flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  private readonly team = inject(TeamStore);
  private readonly activities = inject(ActivitiesStore);
  private readonly clock = inject(CLOCK);
  protected readonly palette = inject(CommandPaletteService);

  readonly navigate = output<void>();

  protected readonly primary = PRIMARY_NAV;
  protected readonly insights = INSIGHT_NAV;
  protected readonly settingsItem = SETTINGS_NAV;

  protected readonly overdue = computed(() => {
    const now = this.clock();
    return this.activities.open().filter((a) => isActivityOverdue(a, now)).length;
  });

  protected readonly user = computed(() => {
    const member = this.team.entityMap()[CURRENT_USER_ID];
    return member ? { name: fullName(member), role: member.role } : null;
  });
}
