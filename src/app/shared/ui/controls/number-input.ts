import { ChangeDetectionStrategy, Component, computed, ElementRef, input, model, viewChild } from '@angular/core';
import { FormValueControl, transformedValue, ValidationError } from '@angular/forms/signals';
import { TranslatePipe } from '@ngx-translate/core';
import { FormFieldShell } from '../form-field';
import { ControlBase } from './control-base';

const NOT_A_NUMBER: ValidationError.WithoutFieldTree = { kind: 'parse', message: 'validation.number' };

/**
 * Numeric control on a native `<input type="number">` (spin buttons, arrow-key
 * stepping, numeric keyboards). `min`/`max` are bound from the field's
 * `min()`/`max()` validators; text that is not a number is reported to the field
 * as a parse error instead of silently becoming 0.
 */
@Component({
  selector: 'ui-number-input',
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
      <div class="relative">
        <input
          #control
          type="number"
          class="control tabular"
          [class.pe-12]="!!unit()"
          [id]="controlId()"
          [value]="raw()"
          [disabled]="disabled()"
          [readOnly]="readonly()"
          [attr.step]="step()"
          [attr.min]="min() ?? null"
          [attr.max]="max() ?? null"
          [attr.name]="name() || null"
          [attr.placeholder]="placeholder() || null"
          [attr.aria-required]="required() || null"
          [attr.aria-invalid]="showErrors() || null"
          [attr.aria-describedby]="describedBy()"
          [attr.data-testid]="testId()"
          inputmode="decimal"
          (input)="raw.set($any($event.target).value)"
          (blur)="markTouched()"
        />
        @if (unit()) {
          <span class="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-fg-subtle">{{ unit() }}</span>
        }
      </div>
    </ui-form-field>
  `,
  host: { class: 'block min-w-0', '[hidden]': 'hidden()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NumberInput extends ControlBase implements FormValueControl<number> {
  readonly value = model(0);
  readonly step = input<number | 'any'>('any');
  /** Short unit shown inside the control, e.g. "%" or "days". */
  readonly unit = input('');
  /** Bound from `min()` / `max()` validators. */
  readonly min = input<number | undefined>(undefined);
  readonly max = input<number | undefined>(undefined);

  protected readonly control = viewChild<ElementRef<HTMLInputElement>>('control');

  protected readonly raw = transformedValue(this.value, {
    parse: (text: string) => {
      const trimmed = text.trim();
      const parsed = Number(trimmed);
      return trimmed === '' || !Number.isFinite(parsed) ? { error: NOT_A_NUMBER } : { value: parsed };
    },
    format: (value: number) => (Number.isFinite(value) ? String(value) : ''),
  });

  /** Bound fields already include parse errors; unbound controls show their own. */
  protected override readonly visibleErrors = computed(() => (this.errors().length ? this.errors() : this.raw.parseErrors()));
}
