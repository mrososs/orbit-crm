import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { CountUp } from './count-up';
import { Skeleton } from './skeleton';

export interface Trend {
  /** Pre-formatted, localized change, e.g. "+12%" or "+4 pts". */
  text: string;
  direction: 'up' | 'down' | 'flat';
  /** Whether the movement is good news (drives color, not the arrow). */
  favorable: boolean;
}

@Component({
  selector: 'ui-stat-card',
  imports: [LucideDynamicIcon, CountUp, Skeleton],
  template: `
    <div class="flex items-start justify-between gap-3">
      <p class="pt-0.5 text-[0.8125rem] leading-5 font-medium text-fg-muted">{{ label() }}</p>
      <span
        class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line-subtle bg-surface-sunken text-fg-muted"
        aria-hidden="true"
      >
        <svg [lucideIcon]="icon()" [size]="15"></svg>
      </span>
    </div>

    @if (loading()) {
      <ui-skeleton class="mt-3 h-8 w-32" />
      <ui-skeleton class="mt-3 h-4 w-40" />
    } @else {
      <p class="mt-2 text-[1.375rem] leading-8 font-semibold tracking-[-0.025em] [overflow-wrap:anywhere] text-fg sm:text-[1.625rem] sm:leading-9">
        @if (value() !== null) {
          <ui-count-up [value]="value()!" [format]="format()" />
        } @else {
          <span class="text-fg-subtle">—</span>
        }
      </p>
      <div class="mt-2 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        @if (trend(); as t) {
          <span
            class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold tabular"
            [class]="trendClass()"
          >
            @if (t.direction !== 'flat') {
              <svg
                [lucideIcon]="t.direction === 'up' ? 'trending-up' : 'trending-down'"
                [size]="13"
                class="rtl-flip"
                aria-hidden="true"
              ></svg>
            }
            <bdi>{{ t.text }}</bdi>
          </span>
        }
        @if (hint()) {
          <span class="min-w-0 text-fg-muted">{{ hint() }}</span>
        }
      </div>
    }
  `,
  host: {
    class: 'card block p-4 sm:p-5 transition-shadow duration-200 hover:shadow-sm',
    '[attr.aria-busy]': 'loading()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatCard {
  readonly label = input.required<string>();
  readonly icon = input('activity');
  readonly value = input<number | null>(null);
  readonly format = input<(value: number) => string>((v) => String(Math.round(v)));
  readonly trend = input<Trend | null>(null);
  readonly hint = input('');
  readonly loading = input(false, { transform: booleanAttribute });

  protected readonly trendClass = computed(() => {
    const t = this.trend();
    if (!t || t.direction === 'flat') return 'bg-neutral-soft text-neutral-soft-fg';
    return t.favorable ? 'bg-success-soft text-success-soft-fg' : 'bg-danger-soft text-danger-soft-fg';
  });
}
