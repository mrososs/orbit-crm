import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { KpiSummary } from '../../core/analytics/metrics';
import { LanguageService } from '../../core/i18n/language.service';
import { formatCurrency, formatNumber, formatPercent, formatSignedPercent } from '../../core/i18n/locale.utils';
import { ViewportService } from '../../core/services/viewport.service';
import { StatCard, Trend } from '../../shared/ui/stat-card';

interface KpiCard {
  id: string;
  label: string;
  icon: string;
  value: number | null;
  format: (v: number) => string;
  trend: Trend | null;
  hint: string;
}

/** The six executive KPIs. Trends compare with the preceding period of equal length. */
@Component({
  selector: 'app-dashboard-kpis',
  imports: [StatCard],
  template: `
    @for (card of cards(); track card.id) {
      <ui-stat-card
        [label]="card.label"
        [icon]="card.icon"
        [value]="card.value"
        [format]="card.format"
        [trend]="card.trend"
        [hint]="card.hint"
        [loading]="loading()"
        [attr.data-testid]="'kpi-' + card.id"
      />
    }
  `,
  host: { class: 'grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardKpis {
  private readonly language = inject(LanguageService);
  private readonly viewport = inject(ViewportService);

  readonly kpis = input.required<KpiSummary>();
  readonly loading = input(false);

  protected readonly cards = computed<KpiCard[]>(() => {
    const k = this.kpis();
    const locale = this.language.locale();
    const t = (key: string, params?: Record<string, unknown>) => this.language.t(key, params);
    const compact = this.viewport.isMobile();
    const money = (v: number) => formatCurrency(v, locale, { compact });
    const integer = (v: number) => formatNumber(Math.round(v), locale);

    const ratioTrend = (change: number | null, favorableWhenUp = true): Trend | null => {
      if (change === null) return null;
      const direction = Math.abs(change) < 0.005 ? 'flat' : change > 0 ? 'up' : 'down';
      return {
        text: formatSignedPercent(change, locale),
        direction,
        favorable: direction === 'flat' ? true : (direction === 'up') === favorableWhenUp,
      };
    };

    const pointsTrend = (change: number | null): Trend | null => {
      if (change === null) return null;
      const pts = change * 100;
      const direction = Math.abs(pts) < 0.05 ? 'flat' : pts > 0 ? 'up' : 'down';
      const value = new Intl.NumberFormat(locale, { signDisplay: 'exceptZero', maximumFractionDigits: 1 }).format(pts);
      return { text: t('kpi.points', { value }), direction, favorable: direction !== 'down' };
    };

    const priorHint = (hint: string, change: number | null) =>
      change === null ? `${hint} · ${t('kpi.noPriorData')}` : hint;

    return [
      {
        id: 'revenue',
        label: t('kpi.totalRevenue'),
        icon: 'circle-dollar-sign',
        value: k.revenue.value,
        format: money,
        trend: ratioTrend(k.revenue.change),
        hint: priorHint(this.language.plural('kpi.revenueHint', k.revenue.dealsWon), k.revenue.change),
      },
      {
        id: 'pipeline',
        label: t('kpi.pipelineValue'),
        icon: 'layers',
        value: k.pipeline.value,
        format: money,
        trend: null,
        hint: t('kpi.pipelineHint', { value: formatCurrency(k.pipeline.weighted, locale, { compact: true }) }),
      },
      {
        id: 'active-deals',
        label: t('kpi.activeDeals'),
        icon: 'briefcase',
        value: k.activeDeals.value,
        format: integer,
        trend: ratioTrend(k.activeDeals.change),
        hint: this.language.plural('kpi.activeDealsHint', k.activeDeals.created),
      },
      {
        id: 'win-rate',
        label: t('kpi.winRate'),
        icon: 'target',
        value: k.winRate.value === null ? null : k.winRate.value,
        format: (v: number) => formatPercent(v, locale),
        trend: pointsTrend(k.winRate.change),
        hint: t('kpi.winRateHint', { won: k.winRate.won, lost: k.winRate.lost }),
      },
      {
        id: 'avg-deal',
        label: t('kpi.avgDealSize'),
        icon: 'gauge',
        value: k.avgDealSize.value,
        format: money,
        trend: ratioTrend(k.avgDealSize.change),
        hint:
          k.avgDealSize.previous !== null
            ? t('kpi.avgDealHint', { value: formatCurrency(k.avgDealSize.previous, locale, { compact: true }) })
            : t('kpi.noPriorData'),
      },
      {
        id: 'follow-ups',
        label: t('kpi.openFollowUps'),
        icon: 'calendar-check',
        value: k.followUps.value,
        format: integer,
        trend: null,
        hint: t('kpi.followUpsHint', { overdue: k.followUps.overdue, today: k.followUps.dueToday }),
      },
    ];
  });
}
