import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, model, viewChild } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { formatNumber } from '../../../core/i18n/locale.utils';
import { FormFieldShell } from '../form-field';
import { ControlBase } from './control-base';

/**
 * Multi-line text on a native `<textarea>`. When the field has a `maxLength()`
 * validator, a live character counter is shown and linked to the control.
 */
@Component({
  selector: 'ui-textarea',
  imports: [FormFieldShell, TranslatePipe],
  template: `
    <ui-form-field
      [for]="controlId()"
      [label]="label()"
      [hint]="hint()"
      [optional]="optional() ? ('common.optional' | translate) : ''"
      [errors]="visibleErrors()"
      [showErrors]="showErrors()"
    >
      <textarea
        #control
        class="control"
        [id]="controlId()"
        [rows]="rows()"
        [value]="value()"
        [disabled]="disabled()"
        [readOnly]="readonly()"
        [attr.name]="name() || null"
        [attr.placeholder]="placeholder() || null"
        [attr.maxlength]="maxLength() ?? null"
        [attr.aria-required]="required() || null"
        [attr.aria-invalid]="showErrors() || null"
        [attr.aria-describedby]="describedByWithCounter()"
        [attr.data-testid]="testId()"
        (input)="value.set($any($event.target).value)"
        (blur)="markTouched()"
      ></textarea>
      @if (maxLength() !== undefined) {
        <p
          class="mt-1 text-end text-2xs tabular"
          [class]="remaining() < 0 ? 'text-danger' : remaining() <= 20 ? 'text-warning-soft-fg' : 'text-fg-subtle'"
          [id]="controlId() + '-count'"
        >
          {{ 'controls.characterCount' | translate: { count: count(), max: limit() } }}
        </p>
      }
    </ui-form-field>
  `,
  host: { class: 'block min-w-0', '[hidden]': 'hidden()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Textarea extends ControlBase implements FormValueControl<string> {
  private readonly language = inject(LanguageService);

  readonly value = model('');
  readonly rows = input(3);
  /** Bound from a `maxLength()` validator. */
  readonly maxLength = input<number | undefined>(undefined);

  protected readonly control = viewChild<ElementRef<HTMLTextAreaElement>>('control');
  protected readonly remaining = computed(() => (this.maxLength() ?? Infinity) - this.value().length);
  protected readonly count = computed(() => formatNumber(this.value().length, this.language.locale()));
  protected readonly limit = computed(() => formatNumber(this.maxLength() ?? 0, this.language.locale()));
  protected readonly describedByWithCounter = computed(() => {
    const ids = [this.describedBy(), this.maxLength() !== undefined ? `${this.controlId()}-count` : null];
    return ids.filter(Boolean).join(' ') || null;
  });
}
