import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Shared chrome for dialogs and drawers: header with title/description and close
 * button, scrollable body, and a sticky footer (`[dialogFooter]` slot).
 */
@Component({
  selector: 'ui-dialog-frame',
  imports: [LucideDynamicIcon, TranslatePipe],
  template: `
    <header class="flex items-start gap-3 border-b border-line-subtle px-5 py-4 sm:px-6">
      @if (icon()) {
        <span
          class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg"
          [class]="tone() === 'danger' ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-primary-soft-fg'"
          aria-hidden="true"
        >
          <svg [lucideIcon]="icon()!" [size]="18"></svg>
        </span>
      }
      <div class="min-w-0 flex-1">
        <h2 class="text-base leading-6 font-semibold text-fg" [id]="titleId()">{{ heading() }}</h2>
        @if (description()) {
          <p class="mt-0.5 text-sm text-fg-muted">{{ description() }}</p>
        }
      </div>
      <button
        type="button"
        class="btn btn-ghost btn-icon btn-sm -me-2 -mt-1"
        (click)="ref.close()"
        [attr.aria-label]="'common.close' | translate"
      >
        <svg lucideIcon="x" aria-hidden="true"></svg>
      </button>
    </header>
    <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
      <ng-content />
    </div>
    <footer
      class="flex flex-col-reverse gap-2 border-t border-line-subtle bg-surface-sunken/60 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-end sm:px-6 empty:hidden"
    >
      <ng-content select="[dialogFooter]" />
    </footer>
  `,
  host: {
    class: 'flex flex-col overflow-hidden bg-surface text-fg shadow-lg border border-line',
    '[class.rounded-2xl]': 'variant() === "dialog"',
    '[class.max-h-[calc(100dvh-2rem)]]': 'variant() === "dialog"',
    '[class.h-dvh]': 'variant() === "drawer"',
    '[attr.role]': '"document"',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogFrame {
  protected readonly ref = inject(DialogRef);

  readonly heading = input.required<string>();
  readonly description = input('');
  readonly icon = input<string | null>(null);
  readonly tone = input<'default' | 'danger'>('default');
  readonly variant = input<'dialog' | 'drawer'>('dialog');
  readonly titleId = input('dialog-title');
}
