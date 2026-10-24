import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FieldState } from '@angular/forms/signals';
import { LucideDynamicIcon } from '@lucide/angular';
import { LanguageService } from '../../core/i18n/language.service';

/** Maps Signal Forms error kinds to translation keys (custom validators pass their own key as `message`). */
const ERROR_KEYS: Record<string, string> = {
  required: 'validation.required',
  email: 'validation.email',
  minLength: 'validation.minLength',
  maxLength: 'validation.maxLength',
  min: 'validation.min',
  max: 'validation.max',
  pattern: 'validation.pattern',
};

/** The subset of a Signal Forms `ValidationError` the shell reads. */
export interface ValidationLike {
  readonly kind: string;
  readonly message?: string;
}

/** Translates a validation error; `message` may itself be a translation key. */
export function validationMessage(error: ValidationLike, t: LanguageService['t']): string {
  const key = error.message ?? ERROR_KEYS[error.kind] ?? 'validation.invalid';
  const extra = error as unknown as Record<string, unknown>;
  return t(key, {
    min: extra['min'],
    max: extra['max'],
    count: extra['minLength'] ?? extra['maxLength'],
  });
}

/**
 * Label + control + hint/error wrapper for Signal Forms. Errors appear once the
 * field is touched (or after a submit attempt) and are announced politely.
 *
 * Native controls pass their field (`[field]`); custom controls that receive
 * `errors`/`touched` from `[formField]` pass those directly (`[errors]`, `[showErrors]`).
 */
@Component({
  selector: 'ui-form-field',
  imports: [LucideDynamicIcon],
  template: `
    @if (label()) {
      <label class="label" [attr.for]="for()" [id]="for() + '-label'">
        {{ label() }}
        @if (optional()) {
          <span class="ms-1 font-normal text-fg-subtle">{{ optional() }}</span>
        }
      </label>
    }
    <ng-content />
    @if (error(); as message) {
      <p class="field-error" [id]="for() + '-error'" aria-live="polite">
        <svg lucideIcon="circle-alert" [size]="13" aria-hidden="true"></svg>{{ message }}
      </p>
    } @else if (hint()) {
      <p class="field-hint" [id]="for() + '-hint'">{{ hint() }}</p>
    }
  `,
  host: { class: 'block min-w-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormFieldShell {
  private readonly language = inject(LanguageService);

  readonly label = input('');
  readonly for = input.required<string>();
  readonly hint = input('');
  readonly optional = input('');
  readonly field = input<(() => FieldState<unknown, string>) | null>(null);
  readonly errors = input<readonly ValidationLike[]>([]);
  readonly showErrors = input(false);

  protected readonly error = computed(() => {
    const field = this.field();
    let first: ValidationLike | undefined;
    if (field) {
      const state = field();
      if (!state.touched() || state.valid()) return null;
      first = state.errors()[0] as unknown as ValidationLike | undefined;
    } else if (this.showErrors()) {
      first = this.errors()[0];
    }
    return first ? validationMessage(first, (key, params) => this.language.t(key, params)) : null;
  });
}
