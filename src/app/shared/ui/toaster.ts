import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { Toast, ToastService, ToastTone } from '../../core/services/toast.service';

const ICONS: Record<ToastTone, string> = {
  success: 'circle-check',
  error: 'circle-alert',
  info: 'info',
  warning: 'triangle-alert',
};

const ICON_TONE: Record<ToastTone, string> = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-info',
  warning: 'text-warning',
};

@Component({
  selector: 'ui-toaster',
  imports: [LucideDynamicIcon, TranslatePipe],
  template: `
    <ol class="flex flex-col gap-2" aria-live="polite" aria-relevant="additions">
      @for (toast of toasts(); track toast.id) {
        <li
          class="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-lg sm:w-[22rem]"
          style="animation: toast-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1)"
          [attr.role]="toast.tone === 'error' ? 'alert' : 'status'"
          (mouseenter)="service.pause(toast.id)"
          (mouseleave)="service.resume(toast.id)"
          (focusin)="service.pause(toast.id)"
          (focusout)="service.resume(toast.id)"
          data-testid="toast"
        >
          <span class="mt-px flex shrink-0" [class]="iconTone(toast)" aria-hidden="true">
            <svg [lucideIcon]="icon(toast)" [size]="18"></svg>
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm leading-5 font-medium text-fg">{{ toast.title | translate: params(toast) }}</p>
            @if (toast.message) {
              <p class="mt-0.5 text-[0.8125rem] text-fg-muted">{{ toast.message | translate: params(toast) }}</p>
            }
          </div>
          @if (toast.action; as action) {
            <button
              type="button"
              class="btn btn-sm btn-ghost -my-1 text-primary-soft-fg"
              (click)="runAction(toast)"
            >
              {{ action.label | translate }}
            </button>
          }
          <button
            type="button"
            class="-me-1 -mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-hover hover:text-fg"
            (click)="service.dismiss(toast.id)"
            [attr.aria-label]="'common.dismiss' | translate"
          >
            <svg lucideIcon="x" [size]="14" aria-hidden="true"></svg>
          </button>
        </li>
      }
    </ol>
  `,
  host: {
    class:
      'pointer-events-none fixed inset-x-4 bottom-4 z-[1100] flex flex-col items-stretch sm:inset-x-auto sm:end-5 sm:bottom-5',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toaster {
  protected readonly service = inject(ToastService);
  private readonly language = inject(LanguageService);
  protected readonly toasts = this.service.toasts;

  /** Resolves translation-key params in the active language (re-evaluated on switch). */
  protected params(toast: Toast): Record<string, string | number> {
    const resolved: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(toast.params ?? {})) {
      resolved[key] = typeof value === 'object' ? this.language.t(value.translate) : value;
    }
    return resolved;
  }

  protected icon(toast: Toast): string {
    return ICONS[toast.tone];
  }

  protected iconTone(toast: Toast): string {
    return ICON_TONE[toast.tone];
  }

  protected async runAction(toast: Toast): Promise<void> {
    this.service.dismiss(toast.id);
    await toast.action?.run();
  }
}
