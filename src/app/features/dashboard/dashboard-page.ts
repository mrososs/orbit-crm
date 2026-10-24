import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { formatDate } from '../../core/i18n/locale.utils';
import { fullName } from '../../core/models';
import { CURRENT_USER_ID } from '../../core/services/session';
import { Chart } from '../../shared/charts/chart';
import { bucketAxisLabel, bucketLongLabel, createFormatters } from '../../shared/charts/chart-utils';
import { Timeline } from '../../shared/domain/timeline';
import { LocalDatePipe, NumberPipe, PercentPipe } from '../../shared/pipes/locale-pipes';
import { RangeFilter } from '../../shared/ui/range-filter';
import { Skeleton } from '../../shared/ui/skeleton';
import { TeamStore, TimelineStore } from '../../state/entity-stores';
import { monthlyWonChart, pipelineChart, revenueChart, sourcesChart } from './dashboard-charts';
import { DashboardKpis } from './dashboard-kpis';
import { DashboardStore } from './dashboard.store';
import { TeamLeaderboard } from './team-leaderboard';
import { Select } from '../../shared/ui/controls/select';

@Component({
  selector: 'app-dashboard-page',
  imports: [Select, 
    TranslatePipe,
    RangeFilter,
    DashboardKpis,
    Chart,
    TeamLeaderboard,
    Timeline,
    Skeleton,
    NumberPipe,
    PercentPipe,
    LocalDatePipe,
  ],
  template: `
    <div class="page animate-rise-in">
      <header class="page-header">
        <div class="min-w-0">
          <h1 class="page-title">{{ 'dashboard.title' | translate }}</h1>
          <p class="page-description">{{ 'dashboard.subtitle' | translate: { name: firstName() } }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <ui-range-filter [value]="store.selection()" (changed)="store.setRange($event)" />
          <ui-select inputId="dashboard-owner" size="sm" class="min-w-40" testId="dashboard-owner" [ariaLabel]="'filters.teamMember' | translate" [options]="ownerSelectOptions()" [value]="store.ownerId()" (valueChange)="store.setOwner($event)" />
        </div>
      </header>

      <p class="-mt-3 mb-5 text-xs text-fg-subtle" data-testid="comparison-range">
        {{ 'ranges.comparedWith' | translate: { start: (store.previous().start | localDate), end: (store.previous().end | localDate) } }}
      </p>

      <app-dashboard-kpis [kpis]="store.kpis()" [loading]="store.loading()" />

      <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 page-xl:grid-cols-12">
        <!-- Revenue performance -->
        <section class="card flex flex-col lg:col-span-2 page-xl:col-span-8" aria-labelledby="revenue-title">
          <div class="card-header flex-wrap">
            <div>
              <h2 id="revenue-title" class="card-title">{{ 'dashboard.revenueTitle' | translate }}</h2>
              <p class="card-subtitle">
                {{ (store.granularity() === 'week' ? 'dashboard.revenueSubtitleWeek' : 'dashboard.revenueSubtitleMonth') | translate }}
              </p>
            </div>
            <ul class="flex items-center gap-4 text-xs text-fg-muted">
              <li class="flex items-center gap-1.5">
                <span class="h-0.5 w-4 rounded-full bg-[var(--chart-1)]" aria-hidden="true"></span>{{ 'charts.thisPeriod' | translate }}
              </li>
              @if (hasPrevious()) {
                <li class="flex items-center gap-1.5">
                  <span class="w-4 border-t-[1.5px] border-dashed border-[var(--chart-muted)]" aria-hidden="true"></span>{{ 'charts.previousPeriod' | translate }}
                </li>
              }
            </ul>
          </div>
          <div class="px-3 pb-3 sm:px-4">
            <ui-chart
              [options]="revenueOptions()"
              [height]="290"
              [loading]="store.loading()"
              [empty]="revenueEmpty()"
              [emptyText]="'charts.empty' | translate"
              [ariaLabel]="'dashboard.revenueTitle' | translate"
              data-testid="chart-revenue"
            />
          </div>
        </section>

        <!-- Pipeline by stage -->
        <section class="card flex flex-col page-xl:col-span-4" aria-labelledby="pipeline-title">
          <div class="card-header">
            <div>
              <h2 id="pipeline-title" class="card-title">{{ 'dashboard.pipelineTitle' | translate }}</h2>
              <p class="card-subtitle">{{ 'dashboard.pipelineSubtitle' | translate }}</p>
            </div>
            <div class="text-end">
              <p class="text-2xs font-medium tracking-wide text-fg-subtle uppercase">{{ 'dashboard.openPipeline' | translate }}</p>
              <p class="text-sm font-semibold text-fg tabular">{{ fmt().money(store.kpis().pipeline.value) }}</p>
            </div>
          </div>
          <div class="px-3 pb-3 sm:px-4">
            <ui-chart
              [options]="pipelineOptions()"
              [height]="290"
              [loading]="store.loading()"
              [empty]="pipelineEmpty()"
              [emptyText]="'charts.empty' | translate"
              [ariaLabel]="'dashboard.pipelineTitle' | translate"
              data-testid="chart-pipeline"
            />
          </div>
        </section>

        <!-- Deals won per month -->
        <section class="card flex flex-col page-xl:col-span-4" aria-labelledby="won-title">
          <div class="card-header">
            <div>
              <h2 id="won-title" class="card-title">{{ 'dashboard.wonTitle' | translate }}</h2>
              <p class="card-subtitle">{{ 'dashboard.wonSubtitle' | translate }}</p>
            </div>
            <p class="text-xl font-semibold text-fg tabular" data-testid="won-total">{{ wonTotal() | num }}</p>
          </div>
          <div class="px-3 pb-3 sm:px-4">
            <ui-chart
              [options]="monthlyOptions()"
              [height]="240"
              [loading]="store.loading()"
              [empty]="wonTotal() === 0"
              [emptyText]="'charts.empty' | translate"
              [ariaLabel]="'dashboard.wonTitle' | translate"
              data-testid="chart-won"
            />
          </div>
        </section>

        <!-- Lead sources -->
        <section class="card flex flex-col page-xl:col-span-4" aria-labelledby="sources-title">
          <div class="card-header">
            <div>
              <h2 id="sources-title" class="card-title">{{ 'dashboard.sourcesTitle' | translate }}</h2>
              <p class="card-subtitle">{{ 'dashboard.sourcesSubtitle' | translate }}</p>
            </div>
          </div>
          <div class="grid flex-1 grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-center gap-4 px-5 pb-5">
            <div class="relative">
              <ui-chart
                [options]="sourcesOptions()"
                [height]="160"
                [loading]="store.loading()"
                [empty]="leadTotal() === 0"
                [emptyText]="'charts.empty' | translate"
                [ariaLabel]="'dashboard.sourcesTitle' | translate"
                data-testid="chart-sources"
              />
              @if (!store.loading() && leadTotal() > 0) {
                <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span class="text-xl font-semibold text-fg tabular">{{ leadTotal() | num }}</span>
                  <span class="text-2xs font-medium text-fg-subtle">{{ 'charts.leads' | translate }}</span>
                </div>
              }
            </div>
            <ul class="flex min-w-0 flex-col gap-2">
              @if (store.loading()) {
                @for (i of [1, 2, 3, 4, 5, 6]; track i) {
                  <li><ui-skeleton class="h-4 w-full" /></li>
                }
              } @else {
                @for (s of store.sources(); track s.source; let i = $index) {
                  <li class="flex items-center gap-2 text-[0.8125rem]">
                    <span class="size-2 shrink-0 rounded-sm" [style.background]="'var(--chart-' + (i + 1) + ')'" aria-hidden="true"></span>
                    <span class="min-w-0 flex-1 truncate text-fg-muted">{{ 'enums.source.' + s.source | translate }}</span>
                    <span class="font-medium text-fg tabular">{{ s.count | num }}</span>
                    <span class="w-9 text-end text-xs text-fg-subtle tabular">{{ (leadTotal() ? s.count / leadTotal() : 0) | pct }}</span>
                  </li>
                }
              }
            </ul>
          </div>
        </section>

        <!-- Recent activity -->
        <section class="card flex flex-col lg:row-span-2 page-xl:col-span-4" aria-labelledby="feed-title">
          <div class="card-header">
            <div>
              <h2 id="feed-title" class="card-title">{{ 'dashboard.feedTitle' | translate }}</h2>
              <p class="card-subtitle">{{ 'dashboard.feedSubtitle' | translate }}</p>
            </div>
          </div>
          <div class="flex-1 px-5 pb-5" data-testid="activity-feed">
            @if (timeline.isLoading()) {
              @for (i of [1, 2, 3, 4, 5, 6]; track i) {
                <div class="flex gap-3 pb-5">
                  <ui-skeleton class="size-8 rounded-full" />
                  <div class="flex-1"><ui-skeleton class="h-3.5 w-full" /><ui-skeleton class="mt-2 h-3 w-20" /></div>
                </div>
              }
            } @else {
              <app-timeline [events]="store.feed()" [emptyText]="'dashboard.feedEmpty' | translate" />
            }
          </div>
        </section>

        <!-- Team performance -->
        <section class="card flex flex-col lg:col-span-1 page-xl:col-span-8" aria-labelledby="team-title">
          <div class="card-header">
            <div>
              <h2 id="team-title" class="card-title">{{ 'dashboard.teamTitle' | translate }}</h2>
              <p class="card-subtitle">{{ 'dashboard.teamSubtitle' | translate }}</p>
            </div>
          </div>
          <div class="px-4 pb-3" data-testid="team-leaderboard">
            <app-team-leaderboard [reps]="store.team()" [loading]="store.loading()" />
          </div>
        </section>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  protected readonly store = inject(DashboardStore);
  protected readonly team = inject(TeamStore);
  protected readonly timeline = inject(TimelineStore);
  private readonly language = inject(LanguageService);

  protected readonly name = fullName;
  protected readonly ownerSelectOptions = computed(() => [
    { value: 'all', label: this.language.t('filters.allTeam') },
    ...this.team.members().map((m) => ({ value: m.id, label: fullName(m) })),
  ]);
  protected readonly fmt = computed(() => createFormatters(this.language.locale()));

  protected readonly firstName = computed(() => this.team.entityMap()[CURRENT_USER_ID]?.firstName ?? '');

  protected readonly revenueEmpty = computed(() =>
    this.store.revenue().every((p) => p.revenue === 0 && p.previous === 0),
  );
  protected readonly hasPrevious = computed(() => this.store.revenue().some((p) => p.previous > 0));
  protected readonly pipelineEmpty = computed(() => this.store.pipeline().every((s) => s.count === 0));
  protected readonly wonTotal = computed(() => this.store.monthly().reduce((sum, r) => sum + r.won, 0));
  protected readonly leadTotal = computed(() => this.store.sources().reduce((sum, s) => sum + s.count, 0));

  protected readonly revenueOptions = computed(() => {
    const locale = this.language.locale();
    const granularity = this.store.granularity();
    const points = this.store.revenue();
    return revenueChart(
      points,
      {
        current: this.language.t('charts.thisPeriod'),
        previous: this.language.t('charts.previousPeriod'),
        dealsWon: this.language.t('charts.dealsWon'),
        axis: points.map((p) => bucketAxisLabel(p.bucket, granularity, locale)),
        tooltip: points.map((p) =>
          granularity === 'week'
            ? this.language.t('charts.weekOf', { date: formatDate(p.bucket.key + 'T00:00:00', locale, 'dayMonth') })
            : bucketLongLabel(p.bucket, granularity, locale),
        ),
      },
      this.fmt(),
    );
  });

  protected readonly pipelineOptions = computed(() => {
    const stages = this.store.pipeline();
    return pipelineChart(
      stages,
      {
        stages: stages.map((s) => this.language.t(`enums.stage.${s.stage}`)),
        deals: (count) => this.language.plural('charts.dealsCount', count),
        value: this.language.t('charts.value'),
        weighted: this.language.t('charts.weighted'),
      },
      this.fmt(),
    );
  });

  protected readonly monthlyOptions = computed(() => {
    const locale = this.language.locale();
    const rows = this.store.monthly();
    return monthlyWonChart(
      rows,
      {
        axis: rows.map((r) => bucketAxisLabel(r.bucket, 'month', locale)),
        tooltip: rows.map((r) => bucketLongLabel(r.bucket, 'month', locale)),
        won: this.language.t('charts.dealsWon'),
        revenue: this.language.t('charts.revenue'),
      },
      this.fmt(),
    );
  });

  protected readonly sourcesOptions = computed(() => {
    const sources = this.store.sources();
    return sourcesChart(
      sources,
      {
        sources: sources.map((s) => this.language.t(`enums.source.${s.source}`)),
        leads: (count) => this.language.plural('charts.leadsCount', count),
      },
      this.fmt(),
    );
  });

}
