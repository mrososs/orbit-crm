import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Native `<button>`/`<a>` enhanced with Orbit styling — keeps built-in semantics,
 * focus and keyboard behaviour. Usage: `<button ui-button variant="primary">`.
 */
@Component({
  selector: 'button[ui-button], a[ui-button]',
  imports: [LucideDynamicIcon],
  template: `
    @if (loading()) {
      <svg lucideIcon="loader-circle" class="animate-spin" aria-hidden="true"></svg>
    } @else if (icon()) {
      <svg [lucideIcon]="icon()!" [class.rtl-flip]="flipIcon()" aria-hidden="true"></svg>
    }
    <ng-content />
  `,
  host: {
    '[class]': 'classes()',
    '[attr.aria-busy]': 'loading() || null',
    '[attr.disabled]': 'disabledAttr()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Button {
  readonly variant = input<ButtonVariant>('secondary');
  readonly size = input<ButtonSize>('md');
  readonly icon = input<string | null>(null);
  readonly flipIcon = input(false, { transform: booleanAttribute });
  readonly iconOnly = input(false, { transform: booleanAttribute });
  readonly loading = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly disabledAttr = computed(() => (this.disabled() || this.loading() ? '' : null));

  protected readonly classes = computed(() =>
    [
      'btn',
      `btn-${this.variant()}`,
      this.size() === 'sm' ? 'btn-sm' : this.size() === 'lg' ? 'btn-lg' : '',
      this.iconOnly() ? 'btn-icon' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );
}
