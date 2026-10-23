import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-soft text-neutral-soft-fg',
  primary: 'bg-primary-soft text-primary-soft-fg',
  success: 'bg-success-soft text-success-soft-fg',
  warning: 'bg-warning-soft text-warning-soft-fg',
  danger: 'bg-danger-soft text-danger-soft-fg',
  info: 'bg-info-soft text-info-soft-fg',
};

@Component({
  selector: 'ui-badge',
  template: `
    @if (dot() || dotColor()) {
      <span
        class="size-1.5 shrink-0 rounded-full"
        [style.background]="dotColor() ?? 'currentColor'"
        aria-hidden="true"
      ></span>
    }
    <ng-content />
  `,
  host: {
    '[class]': 'classes()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Badge {
  readonly tone = input<BadgeTone>('neutral');
  readonly dot = input(false, { transform: booleanAttribute });
  /** Custom dot color (CSS value), e.g. a pipeline stage color. */
  readonly dotColor = input<string | null>(null);

  protected readonly classes = computed(
    () =>
      `inline-flex h-5.5 max-w-full items-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap ${TONES[this.tone()]}`,
  );
}
