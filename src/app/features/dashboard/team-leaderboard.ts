import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RepPerformance } from '../../core/analytics/metrics';
import { fullName } from '../../core/models';
import { MoneyPipe, PercentPipe } from '../../shared/pipes/locale-pipes';
import { Avatar } from '../../shared/ui/avatar';
import { EmptyState } from '../../shared/ui/empty-state';
import { Skeleton } from '../../shared/ui/skeleton';
import { Tooltip } from '../../shared/ui/tooltip';

/** Revenue leaderboard with quota-attainment bars (quota pro-rated to the period). */
@Component({
  selector: 'app-team-leaderboard',
  imports: [Avatar, MoneyPipe, PercentPipe, TranslatePipe, Tooltip, Skeleton, EmptyState],
  template: `
    @if (loading()) {
      @for (i of [1, 2, 3, 4, 5]; track i) {
        <div class="flex items-center gap-3 py-2.5">
          <ui-skeleton class="size-8 rounded-full" />
          <div class="flex-1"><ui-skeleton class="h-3.5 w-32" /><ui-skeleton class="mt-2 h-2 w-full" /></div>
        </div>
      }
    } @else if (rows().length === 0) {
      <ui-empty-state compact icon="users" [heading]="'charts.empty' | translate" />
    } @else {
      <ol class="flex flex-col">
        @for (row of rows(); track row.id; let i = $index) {
          <li class="grid grid-cols-[1.25rem_2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-lg px-1 py-2.5">
            <span class="text-xs font-semibold text-fg-subtle tabular">{{ i + 1 }}</span>
            <ui-avatar [name]="row.name" size="md" />
            <div class="min-w-0">
              <div class="flex items-baseline justify-between gap-3">
                <p class="truncate text-sm font-medium text-fg">{{ row.name }}</p>
                <p class="shrink-0 text-sm font-semibold text-fg tabular">{{ row.revenue | money }}</p>
              </div>
              <div
                class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken"
                role="meter"
                aria-valuemin="0"
                aria-valuemax="100"
                [attr.aria-valuenow]="row.attainmentPct"
                [attr.aria-label]="('charts.attainment' | translate) + ' ' + row.name"
                [uiTooltip]="('charts.quota' | translate) + ': ' + (row.quota | money)"
                tabindex="0"
              >
                <div
                  class="h-full rounded-full transition-[width] duration-700 ease-out"
                  [style.width.%]="row.barPct"
                  [style.background]="row.attainment >= 1 ? 'var(--success)' : 'var(--chart-1)'"
                ></div>
              </div>
            </div>
            <div class="w-24 text-end">
              <p class="text-xs font-semibold text-fg tabular">{{ row.attainment | pct }}</p>
              <p class="text-2xs text-fg-subtle tabular">{{ 'charts.winRate' | translate }} {{ row.winRate | pct }}</p>
            </div>
          </li>
        }
      </ol>
    }
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamLeaderboard {
  readonly reps = input.required<RepPerformance[]>();
  readonly loading = input(false);

  protected readonly rows = computed(() =>
    this.reps().map((r) => {
      const attainment = r.attainment ?? 0;
      return {
        id: r.member.id,
        name: fullName(r.member),
        revenue: r.revenue,
        quota: r.quota,
        attainment,
        attainmentPct: Math.round(attainment * 100),
        barPct: Math.min(100, attainment * 100),
        winRate: r.winRate,
      };
    }),
  );
}
