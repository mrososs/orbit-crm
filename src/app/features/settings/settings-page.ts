import { ChangeDetectionStrategy, Component, computed, DOCUMENT, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { RANGE_PRESETS } from '../../core/analytics/date-range';
import { SCHEMA_VERSION } from '../../core/data/seed/generate-seed';
import { LanguageService } from '../../core/i18n/language.service';
import { fullName } from '../../core/models';
import { CLOCK } from '../../core/services/platform';
import { Density, PipelineView, PreferencesService, Preferences, ThemePreference } from '../../core/services/preferences.service';
import { CURRENT_USER_ID } from '../../core/services/session';
import { ToastService } from '../../core/services/toast.service';
import { LocalDatePipe, NumberPipe } from '../../shared/pipes/locale-pipes';
import { Avatar } from '../../shared/ui/avatar';
import { Button } from '../../shared/ui/button';
import { ConfirmService } from '../../shared/ui/dialog/confirm-dialog';
import { toIsoDate } from '../../shared/utils/date';
import {
  ActivitiesStore,
  CompaniesStore,
  ContactsStore,
  DealsStore,
  TeamStore,
  TimelineStore,
} from '../../state/entity-stores';
import { WorkspaceService } from '../../state/workspace.service';
import { Select } from '../../shared/ui/controls/select';

@Component({
  selector: 'app-settings-page',
  imports: [Select, RouterLink, TranslatePipe, LucideDynamicIcon, Avatar, Button, NumberPipe, LocalDatePipe],
  template: `
    <div class="page max-w-5xl animate-rise-in">
      <header class="page-header">
        <div>
          <h1 class="page-title">{{ 'settings.title' | translate }}</h1>
          <p class="page-description">{{ 'settings.subtitle' | translate }}</p>
        </div>
      </header>

      <div class="card divide-y divide-line">
        <!-- Profile -->
        <section class="settings-row" aria-labelledby="s-profile">
          <div>
            <h2 id="s-profile" class="text-sm font-semibold text-fg">{{ 'settings.profile' | translate }}</h2>
            <p class="mt-1 text-[0.8125rem] text-fg-muted">{{ 'settings.profileDescription' | translate }}</p>
          </div>
          @if (user(); as u) {
            <div class="flex items-center gap-3 rounded-xl border border-line-subtle bg-surface-sunken/60 p-3">
              <ui-avatar [name]="name(u)" size="lg" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-fg">{{ name(u) }}</p>
                <p class="truncate text-xs text-fg-muted">{{ 'enums.role.' + u.role | translate }}</p>
                <p class="ltr-content truncate text-xs text-fg-subtle">{{ u.email }}</p>
              </div>
              <span class="rounded-full bg-primary-soft px-2 py-0.5 text-2xs font-semibold text-primary-soft-fg">{{ 'demo.badge' | translate }}</span>
            </div>
          }
        </section>

        <!-- Appearance -->
        <section class="settings-row" aria-labelledby="s-appearance">
          <div>
            <h2 id="s-appearance" class="text-sm font-semibold text-fg">{{ 'settings.appearance' | translate }}</h2>
            <p class="mt-1 text-[0.8125rem] text-fg-muted">{{ 'settings.appearanceDescription' | translate }}</p>
          </div>
          <div class="flex flex-col gap-4">
            <div class="grid grid-cols-3 gap-2" role="radiogroup" [attr.aria-label]="'theme.label' | translate">
              @for (t of themes; track t.id) {
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="prefs.theme() === t.id"
                  class="flex flex-col items-center gap-2 rounded-xl border p-3 text-[0.8125rem] font-medium transition-colors"
                  [class]="prefs.theme() === t.id ? 'border-primary bg-primary-soft text-primary-soft-fg' : 'border-line text-fg-muted hover:border-line-strong hover:text-fg'"
                  (click)="setTheme(t.id)"
                  [attr.data-testid]="'theme-' + t.id"
                >
                  <svg [lucideIcon]="t.icon" [size]="18" aria-hidden="true"></svg>
                  {{ 'theme.' + t.id | translate }}
                </button>
              }
            </div>
            <div class="flex items-center justify-between gap-4">
              <div>
                <p id="reduce-motion-label" class="text-sm font-medium text-fg">{{ 'settings.reduceMotion' | translate }}</p>
                <p class="text-xs text-fg-muted">{{ 'settings.reduceMotionDescription' | translate }}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-labelledby="reduce-motion-label"
                [attr.aria-checked]="prefs.reduceMotion()"
                class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
                [class]="prefs.reduceMotion() ? 'bg-primary' : 'bg-line-strong'"
                (click)="prefs.set('reduceMotion', !prefs.reduceMotion())"
              >
                <span class="inline-block size-5 rounded-full bg-white shadow-sm transition-transform" [class]="knobClass()"></span>
              </button>
            </div>
          </div>
        </section>

        <!-- Language -->
        <section class="settings-row" aria-labelledby="s-language">
          <div>
            <h2 id="s-language" class="text-sm font-semibold text-fg">{{ 'settings.languageTitle' | translate }}</h2>
            <p class="mt-1 text-[0.8125rem] text-fg-muted">{{ 'language.description' | translate }}</p>
          </div>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" [attr.aria-label]="'language.label' | translate">
            @for (lang of language.languages; track lang.code) {
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="language.code() === lang.code"
                [attr.lang]="lang.code"
                class="flex items-center gap-3 rounded-xl border p-3 text-start transition-colors"
                [class]="language.code() === lang.code ? 'border-primary bg-primary-soft' : 'border-line hover:border-line-strong'"
                (click)="language.use(lang.code)"
                [attr.data-testid]="'settings-language-' + lang.code"
              >
                <span class="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-xs font-bold text-fg-muted uppercase">{{ lang.code }}</span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold text-fg">{{ lang.nativeName }}</span>
                  <span class="block text-2xs font-medium text-fg-subtle uppercase">{{ lang.dir }}</span>
                </span>
                @if (language.code() === lang.code) {
                  <svg lucideIcon="circle-check" [size]="17" class="text-primary" aria-hidden="true"></svg>
                }
              </button>
            }
          </div>
        </section>

        <!-- Preferences -->
        <section class="settings-row" aria-labelledby="s-prefs">
          <div>
            <h2 id="s-prefs" class="text-sm font-semibold text-fg">{{ 'settings.preferences' | translate }}</h2>
            <p class="mt-1 text-[0.8125rem] text-fg-muted">{{ 'settings.preferencesDescription' | translate }}</p>
          </div>
          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
              <label for="pref-range" class="text-sm font-medium text-fg">{{ 'settings.defaultRange' | translate }}</label>
              <ui-select inputId="pref-range" size="sm" class="sm:w-48" testId="pref-range" [options]="rangeOptions()" [value]="prefs.dashboardRange()" (valueChange)="setRange($event)" />
            </div>
            <div class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
              <span id="pref-view" class="text-sm font-medium text-fg">{{ 'settings.defaultView' | translate }}</span>
              <div class="segmented" role="group" aria-labelledby="pref-view">
                @for (v of views; track v) {
                  <button type="button" [attr.aria-pressed]="prefs.pipelineView() === v" (click)="setView(v)">{{ 'pipeline.' + v | translate }}</button>
                }
              </div>
            </div>
            <div class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
              <span id="pref-density" class="text-sm font-medium text-fg">{{ 'settings.density' | translate }}</span>
              <div class="segmented" role="group" aria-labelledby="pref-density">
                <button type="button" [attr.aria-pressed]="prefs.density() === 'comfortable'" (click)="setDensity('comfortable')">{{ 'settings.densityComfortable' | translate }}</button>
                <button type="button" [attr.aria-pressed]="prefs.density() === 'compact'" (click)="setDensity('compact')">{{ 'settings.densityCompact' | translate }}</button>
              </div>
            </div>
          </div>
        </section>

        <!-- Demo data -->
        <section id="demo-data" class="settings-row scroll-mt-20" aria-labelledby="s-data">
          <div>
            <h2 id="s-data" class="text-sm font-semibold text-fg">{{ 'settings.dataTitle' | translate }}</h2>
            <p class="mt-1 text-[0.8125rem] text-fg-muted">{{ 'settings.dataDescription' | translate }}</p>
          </div>
          <div>
            <dl class="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="dataset-counts">
              @for (c of counts(); track c.key) {
                <div class="rounded-xl border border-line-subtle bg-surface-sunken/60 px-3 py-2.5">
                  <dt class="text-xs text-fg-muted">{{ 'settings.counts.' + c.key | translate }}</dt>
                  <dd class="mt-0.5 text-lg font-semibold text-fg tabular" [attr.data-testid]="'count-' + c.key">{{ c.value | num }}</dd>
                </div>
              }
            </dl>
            <ul class="mt-3 flex flex-col gap-1 text-xs text-fg-muted">
              @if (workspace.info(); as info) {
                <li class="flex items-center gap-1.5"><svg lucideIcon="calendar" [size]="13" aria-hidden="true"></svg>{{ 'settings.seededOn' | translate: { date: (info.seededAt | localDate: 'long') } }}</li>
                <li class="flex items-center gap-1.5"><svg lucideIcon="database" [size]="13" aria-hidden="true"></svg>{{ 'settings.storage' | translate: { size: storageSize() } }}</li>
              }
              <li class="flex items-center gap-1.5"><svg lucideIcon="layers" [size]="13" aria-hidden="true"></svg>{{ 'settings.schema' | translate: { version: schemaVersion } }}</li>
            </ul>
            <div class="mt-4 flex flex-wrap gap-2">
              <button ui-button size="sm" icon="download" (click)="exportData()" data-testid="export-data">{{ 'settings.export' | translate }}</button>
              <button ui-button size="sm" variant="danger" icon="rotate-ccw" (click)="reset()" data-testid="reset-data">{{ 'settings.reset' | translate }}</button>
            </div>
          </div>
        </section>

        <!-- About -->
        <section class="settings-row" aria-labelledby="s-about">
          <div>
            <h2 id="s-about" class="text-sm font-semibold text-fg">{{ 'settings.about' | translate }}</h2>
            <p class="mt-1 text-[0.8125rem] text-fg-muted">{{ 'app.tagline' | translate }}</p>
          </div>
          <div>
            <p class="text-sm leading-6 text-fg-muted">{{ 'settings.aboutText' | translate }}</p>
            <p class="mt-3 text-xs font-medium text-fg-subtle">{{ 'settings.builtWith' | translate }}</p>
            <ul class="mt-2 flex flex-wrap gap-1.5">
              @for (tech of stack; track tech) {
                <li class="ltr-content rounded-md border border-line bg-surface px-2 py-0.5 text-xs font-medium text-fg-muted">{{ tech }}</li>
              }
            </ul>
            <a routerLink="/showcase" class="link mt-4 inline-flex items-center gap-1.5 text-sm" data-testid="showcase-link">
              <svg lucideIcon="component" [size]="15" aria-hidden="true"></svg>{{ 'settings.showcaseLink' | translate }}
            </a>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: `
    .settings-row {
      display: grid;
      gap: 1rem;
      padding: 1.5rem;
    }
    @media (min-width: 768px) {
      .settings-row {
        grid-template-columns: minmax(0, 15rem) minmax(0, 1fr);
        gap: 2.5rem;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage implements OnInit {
  private readonly document = inject(DOCUMENT);
  private readonly clock = inject(CLOCK);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly team = inject(TeamStore);
  private readonly companies = inject(CompaniesStore);
  private readonly contacts = inject(ContactsStore);
  private readonly deals = inject(DealsStore);
  private readonly activities = inject(ActivitiesStore);
  private readonly timeline = inject(TimelineStore);
  protected readonly prefs = inject(PreferencesService);
  protected readonly language = inject(LanguageService);
  protected readonly workspace = inject(WorkspaceService);

  protected readonly name = fullName;
  protected readonly schemaVersion = SCHEMA_VERSION;
  protected readonly ranges = RANGE_PRESETS;
  protected readonly rangeOptions = computed(() => this.ranges.map((r) => ({ value: r, label: this.language.t(`ranges.${r}`) })));
  protected readonly views: PipelineView[] = ['board', 'list'];
  protected readonly themes: { id: ThemePreference; icon: string }[] = [
    { id: 'light', icon: 'sun' },
    { id: 'dark', icon: 'moon' },
    { id: 'system', icon: 'monitor' },
  ];
  protected readonly stack = ['Angular 21', 'TypeScript', 'Signals', 'NgRx SignalStore', 'Tailwind CSS 4', 'Angular CDK', 'Apache ECharts', 'ngx-translate', 'Lucide', 'AG-UI', 'A2UI', 'Zod'];

  protected readonly user = computed(() => this.team.entityMap()[CURRENT_USER_ID]);
  protected readonly knobClass = computed(() => {
    const on = this.prefs.reduceMotion();
    const rtl = this.language.isRtl();
    return on ? (rtl ? '-translate-x-[1.375rem]' : 'translate-x-[1.375rem]') : rtl ? '-translate-x-0.5' : 'translate-x-0.5';
  });
  protected readonly counts = computed(() => [
    { key: 'companies', value: this.companies.entities().length },
    { key: 'contacts', value: this.contacts.entities().length },
    { key: 'deals', value: this.deals.entities().length },
    { key: 'activities', value: this.activities.entities().length },
    { key: 'team', value: this.team.entities().length },
    { key: 'events', value: this.timeline.entities().length },
  ]);
  protected readonly storageSize = computed(() => {
    const bytes = this.workspace.info()?.storageBytes ?? 0;
    const locale = this.language.locale();
    return new Intl.NumberFormat(locale, { style: 'unit', unit: 'kilobyte', maximumFractionDigits: 0 }).format(bytes / 1024);
  });

  ngOnInit(): void {
    void this.workspace.refreshInfo();
  }

  protected setTheme(theme: ThemePreference): void {
    this.prefs.set('theme', theme);
  }

  protected setRange(value: string): void {
    this.prefs.set('dashboardRange', value as Preferences['dashboardRange']);
  }

  protected setView(view: PipelineView): void {
    this.prefs.set('pipelineView', view);
  }

  protected setDensity(density: Density): void {
    this.prefs.set('density', density);
  }

  protected async exportData(): Promise<void> {
    const snapshot = await this.workspace.exportSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = `orbit-crm-workspace-${toIsoDate(this.clock())}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.toast.success('settings.exported');
  }

  protected async reset(): Promise<void> {
    const confirmed = await this.confirmService.confirm({
      title: 'settings.resetTitle',
      message: 'settings.resetMessage',
      confirmLabel: 'settings.resetConfirm',
      tone: 'danger',
      icon: 'rotate-ccw',
      onConfirm: async () => {
        await this.workspace.reset();
      },
    });
    if (confirmed) this.toast.success('settings.resetDone');
  }
}
