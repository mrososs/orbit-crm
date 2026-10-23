import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';

/** Friendly empty/zero/error state. Pass already-translated text. */
@Component({
  selector: 'ui-empty-state',
  imports: [LucideDynamicIcon],
  template: `
    <div class="relative mb-4">
      <div class="absolute inset-0 -m-3 rounded-full bg-primary-soft opacity-60 blur-xl" aria-hidden="true"></div>
      <div
        class="relative flex size-12 items-center justify-center rounded-xl border border-line bg-surface text-fg-muted shadow-sm"
        [class.text-danger]="tone() === 'error'"
      >
        <svg [lucideIcon]="icon()" [size]="22" aria-hidden="true"></svg>
      </div>
    </div>
    <p class="text-[0.9375rem] font-semibold text-fg" [attr.role]="headingLevel() ? 'heading' : null" [attr.aria-level]="headingLevel()">
      {{ heading() }}
    </p>
    @if (description()) {
      <p class="mt-1 max-w-sm text-sm text-fg-muted">{{ description() }}</p>
    }
    <div class="mt-4 flex flex-wrap items-center justify-center gap-2 empty:hidden">
      <ng-content />
    </div>
  `,
  host: {
    class: 'flex flex-col items-center justify-center px-6 text-center',
    '[class.py-14]': '!compact()',
    '[class.py-8]': 'compact()',
    role: 'status',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyState {
  readonly icon = input('inbox');
  readonly heading = input.required<string>();
  readonly description = input<string>('');
  readonly tone = input<'default' | 'error'>('default');
  readonly compact = input(false, { transform: booleanAttribute });
  /** Expose the title as a heading (e.g. 1 on a full-page state). */
  readonly headingLevel = input<number | null>(null);
}
