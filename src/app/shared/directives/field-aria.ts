import { computed, Directive, inject } from '@angular/core';
import { FormField } from '@angular/forms/signals';

/**
 * Augments every Signal Forms control with accessible validation state:
 * `aria-invalid` and `aria-describedby` pointing at the error/hint element
 * rendered by `ui-form-field` (ids derived from the control id).
 */
@Directive({
  // Intentionally extends Angular's own [formField] controls rather than adding a new attribute.
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'input[formField], select[formField], textarea[formField]',
  host: {
    '[attr.aria-invalid]': 'invalid() ? "true" : null',
    '[attr.aria-describedby]': 'describedBy()',
  },
})
export class FieldAria {
  private readonly formField = inject(FormField);

  protected readonly invalid = computed(() => {
    const state = this.formField.state();
    return state.touched() && state.invalid();
  });

  protected readonly describedBy = computed(() => {
    const id = this.formField.element.id;
    if (!id) return null;
    return this.invalid() ? `${id}-error` : `${id}-hint`;
  });
}
