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

/**
 * Label + control + hint/error wrapper for Signal Forms. Errors appear once the
 * field is touched (or after a submit attempt) and are announced politely.
 */
@Component({
  selector: 'ui-form-field',
  imports: [LucideDynamicIcon],
  template: `
    @if (label()) {
      <label class="label" [attr.for]="for()">
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

  protected readonly error = computed(() => {
    const field = this.field();
    if (!field) return null;
    const state = field();
    if (!state.touched() || state.valid()) return null;
    const first = state.errors()[0] as unknown as ({ kind: string; message?: string } & Record<string, unknown>) | undefined;
    if (!first) return null;
    const key = first.message ?? ERROR_KEYS[first.kind] ?? 'validation.invalid';
    return this.language.t(key, {
      min: first['min'],
      max: first['max'],
      count: first['minLength'] ?? first['maxLength'],
    });
  });
}
