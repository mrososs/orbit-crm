import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { A2uiRendererService, CatalogComponent } from '@a2ui/angular';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { LanguageService } from '../../../../core/i18n/language.service';
import { formatCurrency, formatNumber, formatPercent, formatSignedPercent } from '../../../../core/i18n/locale.utils';
import { AssistantLauncher } from '../../../../core/layout/assistant-launcher.service';
import { Button } from '../../../../shared/ui/button';
import { StatCard, Trend } from '../../../../shared/ui/stat-card';
import { ButtonApi, LinkApi, MetricApi, NoticeApi, TextApi } from '../../schemas/a2ui.schemas';
import { dispatchSurfaceAction, recordRoute } from './catalog-utils';

const TEXT_VARIANT = {
  title: 'text-sm font-semibold text-fg',
  body: 'text-sm leading-6',
  caption: 'text-xs',
  label: 'text-[0.8125rem] font-medium',
} as const;

const TEXT_TONE = {
  default: 'text-fg',
  muted: 'text-fg-muted',
  success: 'text-success-soft-fg',
  warning: 'text-warning-soft-fg',
  danger: 'text-danger',
} as const;

@Component({
  selector: 'app-a2ui-text',
  template: `{{ text() }}`,
  host: { class: 'block min-w-0 [overflow-wrap:anywhere]', '[class]': 'classes()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class A2Text extends CatalogComponent<typeof TextApi> {
  protected readonly text = computed(() => this.props()['text']?.value() ?? '');
  protected readonly classes = computed(() => {
    const variant = this.props()['variant']?.value() ?? 'body';
    const tone = this.props()['tone']?.value() ?? (variant === 'caption' ? 'muted' : 'default');
    return `${TEXT_VARIANT[variant]} ${TEXT_TONE[tone]}`;
  });
}

const NOTICE_STYLE = {
  success: { box: 'border-success/30 bg-success-soft text-success-soft-fg', icon: 'circle-check' },
  info: { box: 'border-info/30 bg-info-soft text-info-soft-fg', icon: 'info' },
  warning: { box: 'border-warning/30 bg-warning-soft text-warning-soft-fg', icon: 'triangle-alert' },
  danger: { box: 'border-danger/30 bg-danger-soft text-danger-soft-fg', icon: 'circle-alert' },
} as const;

@Component({
  selector: 'app-a2ui-notice',
  imports: [LucideDynamicIcon],
  template: `
    <div class="flex items-start gap-2.5 rounded-xl border px-3 py-2.5" [class]="style().box" role="status" [attr.data-testid]="testId()">
      <svg [lucideIcon]="style().icon" [size]="16" class="mt-0.5 shrink-0" aria-hidden="true"></svg>
      <div class="min-w-0">
        <p class="text-sm font-semibold">{{ title() }}</p>
        @if (message()) {
          <p class="mt-0.5 text-xs leading-5 opacity-90">{{ message() }}</p>
        }
      </div>
    </div>
  `,
  host: { class: 'block min-w-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class A2Notice extends CatalogComponent<typeof NoticeApi> {
  protected readonly style = computed(() => NOTICE_STYLE[this.props()['tone']?.value() ?? 'info']);
  protected readonly title = computed(() => this.props()['title']?.value() ?? '');
  protected readonly message = computed(() => this.props()['message']?.value() ?? '');
  protected readonly testId = computed(() => this.props()['testId']?.value() ?? null);
}

/** KPI tile — reuses the dashboard's stat card; values are formatted for the active language. */
@Component({
  selector: 'app-a2ui-metric',
  imports: [StatCard],
  template: `
    <ui-stat-card
      class="h-full !p-3.5"
      [label]="label()"
      [icon]="icon()"
      [value]="value()"
      [format]="format()"
      [trend]="trend()"
      [hint]="hint()"
      [attr.data-testid]="testId()"
    />
  `,
  host: { class: 'block min-w-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class A2Metric extends CatalogComponent<typeof MetricApi> {
  private readonly language = inject(LanguageService);

  protected readonly label = computed(() => this.props()['label']?.value() ?? '');
  protected readonly icon = computed(() => this.props()['icon']?.value() ?? 'chart-column');
  protected readonly hint = computed(() => this.props()['hint']?.value() ?? '');
  protected readonly testId = computed(() => this.props()['testId']?.value() ?? null);
  protected readonly value = computed(() => {
    const v = this.props()['value']?.value() as unknown;
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  });
  protected readonly format = computed(() => {
    const locale = this.language.locale();
    switch (this.props()['format']?.value()) {
      case 'currency':
        return (v: number) => formatCurrency(v, locale, { compact: true });
      case 'percent':
        return (v: number) => formatPercent(v, locale);
      default:
        return (v: number) => formatNumber(v, locale);
    }
  });
  protected readonly trend = computed<Trend | null>(() => {
    const change = this.props()['change']?.value() as unknown;
    if (typeof change !== 'number' || !Number.isFinite(change)) return null;
    return {
      text: formatSignedPercent(change, this.language.locale()),
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
      favorable: change >= 0,
    };
  });
}

/** Navigation to an application page or a record; routes are built from allowlisted kinds, never from raw URLs. */
@Component({
  selector: 'app-a2ui-link',
  imports: [RouterLink, LucideDynamicIcon],
  template: `
    <a
      [routerLink]="route()"
      [class]="variant() === 'button' ? 'btn btn-secondary btn-sm' : 'link inline-flex items-center gap-1.5 text-sm'"
      [attr.data-testid]="testId()"
      (click)="launcher.closeIfOverlay()"
    >
      @if (icon()) {
        <svg [lucideIcon]="icon()!" [size]="14" aria-hidden="true"></svg>
      }
      {{ label() }}
    </a>
  `,
  host: { class: 'inline-flex min-w-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class A2Link extends CatalogComponent<typeof LinkApi> {
  protected readonly launcher = inject(AssistantLauncher);
  protected readonly label = computed(() => this.props()['label']?.value() ?? '');
  protected readonly icon = computed(() => this.props()['icon']?.value() ?? null);
  protected readonly variant = computed(() => this.props()['variant']?.value() ?? 'link');
  protected readonly testId = computed(() => this.props()['testId']?.value() ?? null);
  protected readonly route = computed(() => {
    const to = this.props()['to']?.value() as { page?: string; record?: { kind: 'deal' | 'contact' | 'company'; id: unknown } } | undefined;
    if (to?.page) return ['/', to.page];
    // A record id bound to the data model (`{ path }`) arrives here already resolved by the binder.
    if (to?.record && typeof to.record.id === 'string') return recordRoute(to.record.kind, to.record.id);
    return null;
  });
}

@Component({
  selector: 'app-a2ui-button',
  imports: [Button],
  template: `
    <button
      ui-button
      type="button"
      size="sm"
      class="h-auto min-h-8 max-w-full py-1 text-start whitespace-normal"
      [variant]="variant()"
      [icon]="icon()"
      [disabled]="disabled()"
      [attr.data-testid]="testId()"
      (click)="activate()"
    >
      {{ label() }}
    </button>
  `,
  host: { class: 'inline-flex min-w-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class A2Button extends CatalogComponent<typeof ButtonApi> {
  private readonly renderer = inject(A2uiRendererService);
  protected readonly label = computed(() => this.props()['label']?.value() ?? '');
  protected readonly icon = computed(() => this.props()['icon']?.value() ?? null);
  protected readonly variant = computed(() => this.props()['variant']?.value() ?? 'secondary');
  protected readonly disabled = computed(() => this.props()['disabled']?.value() === true);
  protected readonly testId = computed(() => this.props()['testId']?.value() ?? null);

  protected activate(): void {
    dispatchSurfaceAction(this.renderer, this.surfaceId(), this.dataContextPath(), this.componentId(), this.props()['action']?.raw);
  }
}
