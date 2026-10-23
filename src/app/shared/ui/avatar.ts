import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { initials } from '../../core/models';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<AvatarSize, string> = {
  xs: 'size-5 text-[0.5625rem]',
  sm: 'size-6 text-[0.625rem]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
  xl: 'size-14 text-lg',
};

/** Soft, theme-friendly hues; picked deterministically from the name. */
const HUES = [243, 199, 160, 32, 340, 268, 186, 12, 218, 145];

@Component({
  selector: 'ui-avatar',
  template: `{{ letters() }}`,
  host: {
    role: 'img',
    '[attr.aria-label]': 'name()',
    '[class]': 'classes()',
    '[style.--avatar-h]': 'hue()',
  },
  styles: `
    :host {
      background: hsl(var(--avatar-h) 70% 94%);
      color: hsl(var(--avatar-h) 45% 32%);
      box-shadow: inset 0 0 0 1px hsl(var(--avatar-h) 50% 85%);
    }
    :host-context(.dark) {
      background: hsl(var(--avatar-h) 35% 20%);
      color: hsl(var(--avatar-h) 70% 80%);
      box-shadow: inset 0 0 0 1px hsl(var(--avatar-h) 30% 28%);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Avatar {
  readonly name = input.required<string>();
  readonly size = input<AvatarSize>('md');
  readonly square = input(false);

  protected readonly letters = computed(() => initials(this.name()));
  protected readonly hue = computed(() => {
    let hash = 0;
    for (const char of this.name()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return HUES[hash % HUES.length];
  });
  protected readonly classes = computed(
    () =>
      `inline-flex shrink-0 select-none items-center justify-center font-semibold tracking-tight ${SIZES[this.size()]} ${this.square() ? 'rounded-lg' : 'rounded-full'}`,
  );
}
