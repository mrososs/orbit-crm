import { ChangeDetectionStrategy, Component, computed, Directive, ElementRef, input, model, viewChild } from '@angular/core';
import type { FormCheckboxControl } from '@angular/forms/signals';
import { FormFieldShell } from '../form-field';
import { ControlBase } from './control-base';

const TEMPLATE = `
  <ui-form-field [for]="controlId()" [errors]="visibleErrors()" [showErrors]="showErrors()">
    <label
      class="flex items-start gap-3"
      [class.cursor-pointer]="!disabled() && !readonly()"
      [class.opacity-60]="disabled()"
      [attr.for]="controlId()"
    >
      <input
        #control
        type="checkbox"
        [class]="inputClass"
        [attr.role]="role"
        [id]="controlId()"
        [checked]="checked()"
        [disabled]="disabled()"
        [attr.name]="name() || null"
        [attr.aria-readonly]="readonly() || null"
        [attr.aria-required]="required() || null"
        [attr.aria-invalid]="showErrors() || null"
        [attr.aria-describedby]="ariaDescribedBy()"
        [attr.data-testid]="testId()"
        (click)="guardReadonly($event)"
        (change)="checked.set($any($event.target).checked)"
        (blur)="markTouched()"
      />
      <span class="min-w-0">
        <span class="block text-sm leading-5 font-medium text-fg">{{ label() }}</span>
        @if (description()) {
          <span class="mt-0.5 block text-xs text-fg-muted" [id]="controlId() + '-description'">{{ description() }}</span>
        }
      </span>
    </label>
  </ui-form-field>
`;

/** Shared behaviour of the boolean controls (Signal Forms `FormCheckboxControl`). */
@Directive()
abstract class BooleanControl extends ControlBase implements FormCheckboxControl {
  readonly checked = model(false);
  readonly description = input('');

  protected readonly control = viewChild<ElementRef<HTMLInputElement>>('control');
  protected abstract readonly inputClass: string;
  protected abstract readonly role: string | null;

  /** Native checkboxes ignore `readonly`; block the toggle instead. */
  protected guardReadonly(event: Event): void {
    if (this.readonly()) event.preventDefault();
  }

  protected readonly ariaDescribedBy = computed(
    () =>
      [this.description() ? `${this.controlId()}-description` : null, this.describedBy()].filter(Boolean).join(' ') ||
      null,
  );
}

/**
 * Native checkbox for choices that are submitted with a form.
 *
 * `<ui-checkbox [formField]="form.notify" [label]="…" [description]="…" />`
 */
@Component({
  selector: 'ui-checkbox',
  imports: [FormFieldShell],
  template: TEMPLATE,
  host: { class: 'block min-w-0', '[hidden]': 'hidden()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Checkbox extends BooleanControl {
  protected readonly inputClass = 'ui-checkbox mt-0.5 shrink-0';
  protected readonly role = null;
}

/**
 * The same native checkbox exposed as a switch (`role="switch"`), for settings
 * that take effect immediately.
 */
@Component({
  selector: 'ui-toggle',
  imports: [FormFieldShell],
  template: TEMPLATE,
  host: { class: 'block min-w-0', '[hidden]': 'hidden()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toggle extends BooleanControl {
  protected readonly inputClass = 'ui-switch mt-0.5 shrink-0';
  protected readonly role = 'switch';
}
