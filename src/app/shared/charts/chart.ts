import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { ECharts, EChartsCoreOption } from 'echarts/core';
import { LanguageService } from '../../core/i18n/language.service';
import { ThemeService } from '../../core/services/theme.service';
import { EmptyState } from '../ui/empty-state';
import { Skeleton } from '../ui/skeleton';
import { ChartTheme, readChartTheme } from './chart-theme';

export type ChartOptionsBuilder = (theme: ChartTheme) => EChartsCoreOption;

let echartsModule: Promise<typeof import('./echarts-setup')> | null = null;
const loadEcharts = () => (echartsModule ??= import('./echarts-setup'));

/**
 * ECharts container. Takes an options *builder* so colors are resolved from the
 * live theme at render time; re-renders on data, language, theme or direction
 * changes and resizes with its box. Shows skeleton and empty states.
 */
@Component({
  selector: 'ui-chart',
  imports: [Skeleton, EmptyState],
  template: `
    <div
      #canvas
      dir="ltr"
      class="absolute inset-0"
      [class.invisible]="loading() || empty()"
      role="img"
      [attr.aria-label]="ariaLabel()"
    ></div>
    @if (loading() || !ready()) {
      <div class="absolute inset-0 flex items-end gap-3 px-2 pb-6" aria-hidden="true">
        @for (h of skeletonBars; track $index) {
          <ui-skeleton class="flex-1 rounded-t-md rounded-b-sm" [style.height.%]="h" />
        }
      </div>
    } @else if (empty()) {
      <ui-empty-state class="absolute inset-0" compact icon="chart-column" [heading]="emptyText()" />
    }
  `,
  host: {
    class: 'relative block w-full',
    '[style.height.px]': 'height()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Chart {
  private readonly document = inject(DOCUMENT);
  private readonly language = inject(LanguageService);
  private readonly theme = inject(ThemeService);
  private readonly canvas = viewChild.required<ElementRef<HTMLDivElement>>('canvas');

  readonly options = input.required<ChartOptionsBuilder>();
  readonly height = input(280);
  readonly loading = input(false, { transform: booleanAttribute });
  readonly empty = input(false, { transform: booleanAttribute });
  readonly emptyText = input('');
  readonly ariaLabel = input('');

  protected readonly ready = signal(false);
  protected readonly skeletonBars = [42, 64, 50, 78, 58, 88, 70, 92];
  private instance: ECharts | null = null;
  private observer: ResizeObserver | null = null;

  constructor() {
    void loadEcharts().then(() => this.ready.set(true));

    afterRenderEffect(async () => {
      const build = this.options();
      const rtl = this.language.isRtl();
      this.theme.resolved();
      if (!this.ready() || this.loading() || this.empty()) return;

      const { echarts } = await loadEcharts();
      const el = this.canvas().nativeElement;
      if (!this.instance) {
        this.instance = echarts.init(el, undefined, { renderer: 'svg' });
        this.observer = new ResizeObserver(() => this.instance?.resize());
        this.observer.observe(el);
      }
      this.instance.setOption(build(readChartTheme(this.document, rtl)), { notMerge: true });
      this.instance.resize();
    });

    inject(DestroyRef).onDestroy(() => {
      this.observer?.disconnect();
      this.instance?.dispose();
    });
  }
}
