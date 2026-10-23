import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { VALUE_BANDS } from '../../core/analytics/metrics';
import { LanguageService } from '../../core/i18n/language.service';
import { formatCurrency, formatNumber, formatPercent, formatSignedPercent } from '../../core/i18n/locale.utils';
import { fullName, LEAD_SOURCES, LeadSource } from '../../core/models';
import { Chart } from '../../shared/charts/chart';
import { bucketAxisLabel, bucketLongLabel, createFormatters } from '../../shared/charts/chart-utils';
import { MoneyPipe, NumberPipe, PercentPipe } from '../../shared/pipes/locale-pipes';
import { PluralPipe } from '../../shared/pipes/plural.pipe';
import { Avatar } from '../../shared/ui/avatar';
import { RangeFilter } from '../../shared/ui/range-filter';
import { Skeleton } from '../../shared/ui/skeleton';
import { StatCard, Trend } from '../../shared/ui/stat-card';
import { TeamStore } from '../../state/entity-stores';
import {
  conversionChart,
  distributionChart,
  pipelineAnalysisChart,
  revenueTrendChart,
  sourceRevenueChart,
  teamRevenueChart,
} from './reports-charts';
import { ReportsStore } from './reports.store';
import { SelectValue } from '../../shared/directives/select-value';

@Component({
  selector: 'app-reports-page',
  imports: [SelectValue, TranslatePipe, PluralPipe, RangeFilter, Chart, StatCard, Avatar, Skeleton, MoneyPipe, NumberPipe, PercentPipe],
  template: `
    <div class="page animate-rise-in">
      <header class="page-header">
        <div class="min-w-0">
          <h1 class="page-title">{{ 'reports.title' | translate }}</h1>
          <p class="page-description">{{ 'reports.subtitle' | translate }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <ui-range-filter [value]="store.selection()" (changed)="store.setRange($event)" />
          <label class="sr-only" for="reports-owner">{{ 'filters.teamMember' | translate }}</label>
          <select id="reports-owner" class="control control-sm w-auto min-w-40" [uiValue]="store.ownerId()" (change)="store.setOwner($any($event.target).value)">
            <option value="all">{{ 'filters.allTeam' | translate }}</option>
            @for (m of team.members(); track m.id) {
              <option [value]="m.id">{{ name(m) }}</option>
            }
          </select>
          <label class="sr-only" for="reports-source">{{ 'filters.source' | translate }}</label>
          <select id="reports-source" class="control control-sm w-auto min-w-36" [uiValue]="store.source()" (change)="setSource($event)" data-testid="reports-source">
            <option value="all">{{ 'reports.allSources' | translate }}</option>
            @for (s of sources; track s) {
              <option [value]="s">{{ 'enums.source.' + s | translate }}</option>
            }
          </select>
        </div>
      </header>

      <div class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        @for (card of kpis(); track card.id) {
          <ui-stat-card [label]="card.label" [icon]="card.icon" [value]="card.value" [format]="card.format" [trend]="card.trend" [hint]="card.hint" [loading]="store.loading()" />
        }
      </div>

      <div class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <section class="card xl:col-span-8" aria-labelledby="r-revenue">
          <div class="card-header">
            <div>
              <h2 id="r-revenue" class="card-title">{{ 'reports.revenueTrend' | translate }}</h2>
              <p class="card-subtitle">{{ 'reports.revenueTrendSubtitle' | translate }}</p>
            </div>
          </div>
          <div class="px-4 pb-4">
            <ui-chart [options]="revenueOptions()" [height]="300" [loading]="store.loading()" [empty]="revenueEmpty()" [emptyText]="'charts.empty' | translate" [ariaLabel]="'reports.revenueTrend' | translate" data-testid="chart-revenue-trend" />
          </div>
        </section>

        <section class="card xl:col-span-4" aria-labelledby="r-conversion">
          <div class="card-header">
            <div>
              <h2 id="r-conversion" class="card-title">{{ 'reports.conversion' | translate }}</h2>
              <p class="card-subtitle">{{ 'reports.conversionSubtitle' | translate }}</p>
            </div>
          </div>
          <div class="px-4 pb-4">
            <ui-chart [options]="funnelOptions()" [height]="268" [loading]="store.loading()" [empty]="cohortSize() === 0" [emptyText]="'charts.empty' | translate" [ariaLabel]="'reports.conversion' | translate" data-testid="chart-conversion" />
            <p class="mt-2 text-center text-xs text-fg-subtle">{{ 'reports.cohortNote' | plural: cohortSize() }}</p>
          </div>
        </section>

        <section class="card xl:col-span-6" aria-labelledby="r-pipeline">
          <div class="card-header">
            <div>
              <h2 id="r-pipeline" class="card-title">{{ 'reports.pipelineAnalysis' | translate }}</h2>
              <p class="card-subtitle">{{ 'reports.pipelineAnalysisSubtitle' | translate }}</p>
            </div>
          </div>
          <div class="px-4 pb-4">
            <ui-chart [options]="pipelineOptions()" [height]="280" [loading]="store.loading()" [empty]="pipelineEmpty()" [emptyText]="'charts.empty' | translate" [ariaLabel]="'reports.pipelineAnalysis' | translate" />
          </div>
        </section>

        <section class="card xl:col-span-6" aria-labelledby="r-distribution">
          <div class="card-header">
            <div>
              <h2 id="r-distribution" class="card-title">{{ 'reports.distribution' | translate }}</h2>
              <p class="card-subtitle">{{ 'reports.distributionSubtitle' | translate }}</p>
            </div>
          </div>
          <div class="px-4 pb-4">
            <ui-chart [options]="distributionOptions()" [height]="280" [loading]="store.loading()" [empty]="cohortSize() === 0" [emptyText]="'charts.empty' | translate" [ariaLabel]="'reports.distribution' | translate" />
          </div>
        </section>

        <section class="card xl:col-span-12" aria-labelledby="r-team">
          <div class="card-header">
            <div>
              <h2 id="r-team" class="card-title">{{ 'reports.team' | translate }}</h2>
              <p class="card-subtitle">{{ 'reports.teamSubtitle' | translate }}</p>
            </div>
          </div>
          <div class="grid grid-cols-1 gap-4 px-4 pb-4 lg:grid-cols-5">
            <div class="lg:col-span-2">
              <ui-chart [options]="teamOptions()" [height]="320" [loading]="store.loading()" [empty]="store.team().length === 0" [emptyText]="'charts.empty' | translate" [ariaLabel]="'reports.team' | translate" />
            </div>
            <div class="overflow-x-auto rounded-xl border border-line-subtle lg:col-span-3">
              <table class="data-table" data-testid="team-table">
                <thead>
                  <tr>
                    <th scope="col">{{ 'reports.columns.rep' | translate }}</th>
                    <th scope="col" class="text-end">{{ 'reports.columns.revenue' | translate }}</th>
                    <th scope="col" class="text-end">{{ 'reports.columns.won' | translate }}</th>
                    <th scope="col" class="text-end">{{ 'reports.columns.winRate' | translate }}</th>
                    <th scope="col" class="hidden text-end sm:table-cell">{{ 'reports.columns.avgDeal' | translate }}</th>
                    <th scope="col" class="hidden text-end md:table-cell">{{ 'reports.columns.openPipeline' | translate }}</th>
                    <th scope="col" class="text-end">{{ 'reports.columns.attainment' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @if (store.loading()) {
                    @for (i of [1, 2, 3, 4]; track i) {
                      <tr><td colspan="7"><ui-skeleton class="h-4 w-full" /></td></tr>
                    }
                  }
                  @for (r of store.team(); track r.member.id) {
                    <tr>
                      <td>
                        <div class="flex items-center gap-2.5">
                          <ui-avatar [name]="name(r.member)" size="sm" />
                          <span class="truncate font-medium text-fg">{{ name(r.member) }}</span>
                        </div>
                      </td>
                      <td class="text-end font-semibold text-fg tabular">{{ r.revenue | money }}</td>
                      <td class="text-end text-fg tabular">{{ r.won }}</td>
                      <td class="text-end text-fg tabular">{{ r.winRate | pct }}</td>
                      <td class="hidden text-end text-fg-muted tabular sm:table-cell">{{ r.averageDealSize | money: 'compact' }}</td>
                      <td class="hidden text-end text-fg-muted tabular md:table-cell">{{ r.openPipeline | money: 'compact' }}</td>
                      <td class="text-end">
                        <span class="inline-flex min-w-14 justify-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular" [class]="(r.attainment ?? 0) >= 1 ? 'bg-success-soft text-success-soft-fg' : (r.attainment ?? 0) >= 0.7 ? 'bg-warning-soft text-warning-soft-fg' : 'bg-neutral-soft text-neutral-soft-fg'">
                          {{ r.attainment | pct }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section class="card xl:col-span-12" aria-labelledby="r-sources">
          <div class="card-header">
            <div>
              <h2 id="r-sources" class="card-title">{{ 'reports.sources' | translate }}</h2>
              <p class="card-subtitle">{{ 'reports.sourcesSubtitle' | translate }}</p>
            </div>
          </div>
          <div class="grid grid-cols-1 gap-4 px-4 pb-4 lg:grid-cols-5">
            <div class="lg:col-span-2">
              <ui-chart [options]="sourceOptions()" [height]="280" [loading]="store.loading()" [empty]="sourcesEmpty()" [emptyText]="'charts.empty' | translate" [ariaLabel]="'reports.sources' | translate" />
            </div>
            <div class="overflow-x-auto rounded-xl border border-line-subtle lg:col-span-3">
              <table class="data-table" data-testid="sources-table">
                <thead>
                  <tr>
                    <th scope="col">{{ 'reports.columns.source' | translate }}</th>
                    <th scope="col" class="text-end">{{ 'reports.columns.leads' | translate }}</th>
                    <th scope="col" class="text-end">{{ 'reports.columns.deals' | translate }}</th>
                    <th scope="col" class="text-end">{{ 'reports.columns.sourceRevenue' | translate }}</th>
                    <th scope="col" class="text-end">{{ 'reports.columns.winRate' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of store.sources(); track r.source; let i = $index) {
                    <tr>
                      <td>
                        <span class="flex items-center gap-2.5">
                          <span class="size-2.5 rounded-sm" [style.background]="'var(--chart-' + (i + 1) + ')'" aria-hidden="true"></span>
                          <span class="font-medium text-fg">{{ 'enums.source.' + r.source | translate }}</span>
                        </span>
                      </td>
                      <td class="text-end text-fg tabular">{{ r.leads | num }}</td>
                      <td class="text-end text-fg tabular">{{ r.dealsCreated | num }}</td>
                      <td class="text-end font-semibold text-fg tabular">{{ r.revenue | money }}</td>
                      <td class="text-end text-fg-muted tabular">{{ r.winRate | pct }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPage {
  protected readonly store = inject(ReportsStore);
  protected readonly team = inject(TeamStore);
  private readonly language = inject(LanguageService);

  protected readonly name = fullName;
  protected readonly sources = LEAD_SOURCES;
  private readonly fmt = computed(() => createFormatters(this.language.locale()));
  private readonly t = (key: string, params?: Record<string, unknown>) => this.language.t(key, params);

  protected readonly cohortSize = computed(() => this.store.funnel()[0]?.count ?? 0);
  protected readonly revenueEmpty = computed(() => this.store.revenue().every((p) => p.revenue === 0 && p.previous === 0));
  protected readonly pipelineEmpty = computed(() => this.store.pipeline().every((s) => s.count === 0));
  protected readonly sourcesEmpty = computed(() => this.store.sources().every((s) => s.revenue === 0));

  protected readonly kpis = computed(() => {
    const s = this.store.summary();
    const locale = this.language.locale();
    const trend = (change: number | null, favorableWhenUp = true): Trend | null => {
      if (change === null) return null;
      const direction = Math.abs(change) < 0.005 ? 'flat' : change > 0 ? 'up' : 'down';
      return { text: formatSignedPercent(change, locale), direction, favorable: direction === 'flat' || (direction === 'up') === favorableWhenUp };
    };
    const pts = (change: number | null): Trend | null => {
      if (change === null) return null;
      const v = change * 100;
      const direction = Math.abs(v) < 0.05 ? 'flat' : v > 0 ? 'up' : 'down';
      const value = new Intl.NumberFormat(locale, { signDisplay: 'exceptZero', maximumFractionDigits: 1 }).format(v);
      return { text: this.t('kpi.points', { value }), direction, favorable: direction !== 'down' };
    };
    const vs = this.t('kpi.vsPrevious');
    return [
      { id: 'revenue', label: this.t('kpi.totalRevenue'), icon: 'circle-dollar-sign', value: s.revenue, format: (v: number) => formatCurrency(v, locale), trend: trend(s.revenueChange), hint: s.revenueChange === null ? this.language.plural('kpi.revenueHint', s.won) : vs },
      { id: 'won', label: this.t('kpi.dealsWon'), icon: 'trophy', value: s.won, format: (v: number) => formatNumber(Math.round(v), locale), trend: trend(s.wonChange), hint: s.wonChange === null ? this.t('kpi.winRateHint', { won: s.won, lost: s.lost }) : vs },
      { id: 'win-rate', label: this.t('kpi.winRate'), icon: 'target', value: s.winRate, format: (v: number) => formatPercent(v, locale), trend: pts(s.winRateChange), hint: s.winRateChange === null ? this.language.plural('kpi.closedDealsHint', s.won + s.lost) : vs },
      {
        id: 'cycle',
        label: this.t('kpi.salesCycle'),
        icon: 'timer',
        value: s.cycle,
        format: (v: number) => this.language.plural('kpi.salesCycleDays', Math.round(v)),
        trend: trend(s.cycleChange, false),
        hint: this.t('kpi.salesCycleHint'),
      },
    ];
  });

  protected readonly revenueOptions = computed(() => {
    const locale = this.language.locale();
    const points = this.store.revenue();
    return revenueTrendChart(
      points,
      {
        axis: points.map((p) => bucketAxisLabel(p.bucket, 'month', locale)),
        tooltip: points.map((p) => bucketLongLabel(p.bucket, 'month', locale)),
        revenue: this.t('charts.monthlyRevenue'),
        previous: this.t('charts.previousPeriod'),
        won: this.t('charts.dealsWon'),
      },
      this.fmt(),
    );
  });

  protected readonly funnelOptions = computed(() => {
    const steps = this.store.funnel();
    return conversionChart(steps, { stages: steps.map((s) => this.t(`enums.stage.${s.stage}`)), reached: this.t('charts.conversion') }, this.fmt());
  });

  protected readonly pipelineOptions = computed(() => {
    const stages = this.store.pipeline();
    return pipelineAnalysisChart(
      stages,
      {
        stages: stages.map((s) => this.t(`enums.stage.${s.stage}`)),
        total: this.t('charts.value'),
        weighted: this.t('charts.weighted'),
        deals: (count) => this.language.plural('charts.dealsCount', count),
      },
      this.fmt(),
    );
  });

  protected readonly distributionOptions = computed(() => {
    const locale = this.language.locale();
    const money = (v: number) => formatCurrency(v, locale, { compact: true });
    const bands = VALUE_BANDS.map((b) =>
      b.min === 0
        ? this.t('charts.bands.below', { max: money(b.max) })
        : b.max === Number.POSITIVE_INFINITY
          ? this.t('charts.bands.above', { min: money(b.min) })
          : this.t('charts.bands.between', { min: money(b.min), max: money(b.max) }),
    );
    return distributionChart(
      this.store.distribution(),
      { bands, open: this.t('charts.open'), won: this.t('charts.won'), lost: this.t('charts.lost') },
      this.fmt(),
    );
  });

  protected readonly teamOptions = computed(() => {
    const reps = this.store.team();
    return teamRevenueChart(
      reps,
      { names: reps.map((r) => fullName(r.member)), revenue: this.t('charts.revenue'), quota: this.t('charts.quota'), attainment: this.t('charts.attainment') },
      this.fmt(),
    );
  });

  protected readonly sourceOptions = computed(() => {
    const rows = this.store.sources();
    return sourceRevenueChart(
      rows,
      { sources: rows.map((r) => this.t(`enums.source.${r.source}`)), revenue: this.t('charts.revenue'), leads: this.t('charts.leads'), winRate: this.t('charts.winRate') },
      this.fmt(),
    );
  });

  protected setSource(event: Event): void {
    this.store.setSource((event.target as HTMLSelectElement).value as LeadSource | 'all');
  }
}
