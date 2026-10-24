import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { A2uiRendererService, CatalogComponent } from '@a2ui/angular';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../../core/i18n/language.service';
import { formatCurrency, formatDate, formatRelativeDay } from '../../../../core/i18n/locale.utils';
import { AssistantLauncher } from '../../../../core/layout/assistant-launcher.service';
import { CLOCK } from '../../../../core/services/platform';
import { Chart } from '../../../../shared/charts/chart';
import { createFormatters } from '../../../../shared/charts/chart-utils';
import { PriorityBadge, StageBadge } from '../../../../shared/domain/domain-badges';
import { Button } from '../../../../shared/ui/button';
import { pipelineChart } from '../../../dashboard/dashboard-charts';
import { ChartApi, PipelineChartDataSchema, RecordItem, RecordItemListSchema, RecordListApi } from '../../schemas/a2ui.schemas';
import { dispatchSurfaceAction, parseData, recordRoute } from './catalog-utils';

/** List of CRM records with stage/priority badges, dates, links and an optional per-record action. */
@Component({
  selector: 'app-a2ui-record-list',
  imports: [RouterLink, LucideDynamicIcon, StageBadge, PriorityBadge, Button, TranslatePipe],
  template: `
    @if (parsed().error; as error) {
      <p class="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger-soft-fg" role="alert">{{ 'assistant.errors.invalidData' | translate }}</p>
    } @else {
      <ul class="divide-y divide-line-subtle overflow-hidden rounded-xl border border-line bg-surface" [attr.data-testid]="testId()">
        @for (item of items(); track item.id) {
          <li class="flex flex-col gap-1.5 px-3 py-2.5" data-testid="a2ui-record">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                @if (item.link; as link) {
                  <a class="link block truncate text-sm" [routerLink]="route(link)" (click)="launcher.closeIfOverlay()" data-testid="a2ui-record-link">{{ item.title }}</a>
                } @else {
                  <p class="truncate text-sm font-medium text-fg">{{ item.title }}</p>
                }
                @if (item.subtitle) {
                  <p class="truncate text-xs text-fg-muted">{{ item.subtitle }}</p>
                }
              </div>
              @if (item.amount !== undefined) {
                <span class="shrink-0 text-sm font-semibold text-fg tabular">{{ money(item.amount) }}</span>
              }
            </div>
            <div class="flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
              @if (item.stage) {
                <app-stage-badge [stage]="item.stage" />
              }
              @if (item.priority) {
                <app-priority-badge [priority]="item.priority" />
              }
              @if (item.date) {
                <span class="inline-flex items-center gap-1" [class.text-danger]="item.overdue" [class.font-medium]="item.overdue">
                  <svg lucideIcon="calendar-clock" [size]="12" aria-hidden="true"></svg>{{ dateText(item) }}
                </span>
              }
              @if (item.owner) {
                <span class="inline-flex min-w-0 items-center gap-1"><svg lucideIcon="user" [size]="12" aria-hidden="true"></svg><span class="truncate">{{ item.owner }}</span></span>
              }
            </div>
            @if (relatedLinks(item).length || (actionLabel() && item.link?.kind === 'deal')) {
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                @for (rel of relatedLinks(item); track rel.id) {
                  <a class="link inline-flex items-center gap-1 text-xs text-fg-muted" [routerLink]="route(rel)" (click)="launcher.closeIfOverlay()">
                    <svg [lucideIcon]="rel.kind === 'deal' ? 'briefcase' : rel.kind === 'company' ? 'building' : 'user'" [size]="12" aria-hidden="true"></svg>{{ rel.label }}
                  </a>
                }
                @if (actionLabel() && item.link?.kind === 'deal') {
                  <button ui-button type="button" size="sm" variant="ghost" icon="arrow-right-left" class="ms-auto h-7" data-testid="a2ui-record-action" (click)="runItemAction(item)">
                    {{ actionLabel() }}
                  </button>
                }
              </div>
            }
          </li>
        } @empty {
          <li class="px-3 py-4 text-center text-sm text-fg-muted">{{ emptyText() }}</li>
        }
      </ul>
    }
  `,
  host: { class: 'block min-w-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class A2RecordList extends CatalogComponent<typeof RecordListApi> {
  protected readonly language = inject(LanguageService);
  protected readonly launcher = inject(AssistantLauncher);
  private readonly renderer = inject(A2uiRendererService);
  private readonly clock = inject(CLOCK);

  protected readonly parsed = computed(() => parseData(RecordItemListSchema, this.props()['items']?.value()));
  protected readonly items = computed(() => this.parsed().data ?? []);
  protected readonly emptyText = computed(() => this.props()['emptyText']?.value() ?? '');
  protected readonly testId = computed(() => this.props()['testId']?.value() ?? null);
  protected readonly actionLabel = computed(() => (this.props()['itemAction']?.value() as { label?: string } | undefined)?.label ?? '');

  protected route(link: { kind: 'deal' | 'contact' | 'company'; id: string }): string[] {
    return recordRoute(link.kind, link.id);
  }

  protected relatedLinks(item: RecordItem) {
    return (item.related ?? []).filter((r) => r.id !== item.link?.id);
  }

  protected money(value: number): string {
    return formatCurrency(value, this.language.locale(), { compact: true });
  }

  protected dateText(item: RecordItem): string {
    const locale = this.language.locale();
    if (item.dateKind === 'due') return this.language.t('assistant.records.due', { date: formatRelativeDay(item.date!, this.clock(), locale) });
    return this.language.t('assistant.records.closes', { date: formatDate(item.date!, locale, 'medium') });
  }

  protected runItemAction(item: RecordItem): void {
    const action = this.props()['itemAction']?.value() as { name?: string } | undefined;
    if (!action?.name) return;
    dispatchSurfaceAction(this.renderer, this.surfaceId(), this.dataContextPath(), this.componentId(), {
      event: { name: action.name, context: { dealId: item.id } },
    });
  }
}

/** Charts reuse the dashboard's ECharts option builders and the shared lazy-loaded chart container. */
@Component({
  selector: 'app-a2ui-chart',
  imports: [Chart],
  template: `
    <ui-chart
      [options]="options()"
      [height]="height()"
      [empty]="empty()"
      [emptyText]="language.t('assistant.errors.noChartData')"
      [ariaLabel]="label()"
      data-testid="a2ui-chart"
    />
  `,
  host: { class: 'block min-w-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class A2Chart extends CatalogComponent<typeof ChartApi> {
  protected readonly language = inject(LanguageService);

  private readonly stages = computed(() => parseData(PipelineChartDataSchema, this.props()['data']?.value()).data ?? []);
  protected readonly height = computed(() => this.props()['height']?.value() ?? 220);
  protected readonly label = computed(() => this.props()['label']?.value() ?? '');
  protected readonly empty = computed(() => this.stages().every((s) => s.count === 0));
  protected readonly options = computed(() => {
    const stages = this.stages();
    return pipelineChart(
      stages,
      {
        stages: stages.map((s) => this.language.t(`enums.stage.${s.stage}`)),
        deals: (count) => this.language.plural('charts.dealsCount', count),
        value: this.language.t('charts.value'),
        weighted: this.language.t('charts.weighted'),
      },
      createFormatters(this.language.locale()),
    );
  });
}
