import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  untracked,
  viewChild,
} from '@angular/core';
import { FormValueControl, transformedValue, ValidationError } from '@angular/forms/signals';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { WORKSPACE_CURRENCY } from '../../../core/models';
import { FormFieldShell } from '../form-field';
import { ControlBase } from './control-base';

const NOT_AN_AMOUNT: ValidationError.WithoutFieldTree = { kind: 'parse', message: 'validation.amount' };

interface NumberSymbols {
  group: string;
  decimal: string;
}

/** Arabic-Indic and Eastern Arabic-Indic digits typed on Arabic keyboards. */
const DIGIT_MAP: Record<string, string> = Object.fromEntries(
  [...'٠١٢٣٤٥٦٧٨٩'].map((d, i) => [d, String(i)]).concat([...'۰۱۲۳۴۵۶۷۸۹'].map((d, i) => [d, String(i)])),
);

/**
 * Money amount in the workspace currency. Shows the locale's currency symbol as
 * an adornment (before or after the number, as the locale writes it), accepts the
 * locale's separators — and Arabic-Indic digits — when typing, and regroups the
 * digits on blur. Values are never converted between currencies.
 */
@Component({
  selector: 'ui-currency-input',
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
      <div class="relative" dir="ltr">
        @if (symbol().before) {
          <span class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-fg-subtle">{{ symbol().text }}</span>
        }
        <input
          #control
          type="text"
          inputmode="decimal"
          autocomplete="off"
          class="control tabular"
          [style.padding-inline-start]="symbol().before ? symbol().pad : null"
          [style.padding-inline-end]="symbol().before ? null : symbol().pad"
          [id]="controlId()"
          [value]="raw()"
          [disabled]="disabled()"
          [readOnly]="readonly()"
          [attr.name]="name() || null"
          [attr.placeholder]="placeholder() || null"
          [attr.aria-required]="required() || null"
          [attr.aria-invalid]="showErrors() || null"
          [attr.aria-describedby]="describedBy()"
          [attr.data-testid]="testId()"
          (input)="raw.set($any($event.target).value)"
          (blur)="regroup(); markTouched()"
        />
        @if (!symbol().before) {
          <span class="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm text-fg-subtle">{{ symbol().text }}</span>
        }
      </div>
    </ui-form-field>
  `,
  host: { class: 'block min-w-0', '[hidden]': 'hidden()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurrencyInput extends ControlBase implements FormValueControl<number> {
  private readonly language = inject(LanguageService);

  readonly value = model(0);
  readonly currency = input(WORKSPACE_CURRENCY);

  protected readonly control = viewChild<ElementRef<HTMLInputElement>>('control');

  private readonly symbols = computed<NumberSymbols>(() => {
    const parts = new Intl.NumberFormat(this.language.locale()).formatToParts(12345.6);
    return {
      group: parts.find((p) => p.type === 'group')?.value ?? ',',
      decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
    };
  });

  /** Currency symbol as the active locale writes it, and on which side. */
  protected readonly symbol = computed(() => {
    const parts = new Intl.NumberFormat(this.language.locale(), {
      style: 'currency',
      currency: this.currency(),
    }).formatToParts(1);
    const text = parts.find((p) => p.type === 'currency')?.value ?? this.currency();
    const before = parts.findIndex((p) => p.type === 'currency') < parts.findIndex((p) => p.type === 'integer');
    return { text, before, pad: `${0.75 + text.length * 0.55 + 0.4}rem` };
  });

  protected readonly raw = transformedValue(this.value, {
    parse: (text: string) => {
      const { group, decimal } = untracked(this.symbols);
      const normalized = [...text]
        .map((ch) => DIGIT_MAP[ch] ?? ch)
        .join('')
        .replace(/[\s\u00a0\u202f]/g, '')
        .split(group)
        .join('')
        .replace(decimal, '.');
      if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return { error: NOT_AN_AMOUNT };
      return { value: Number(normalized) };
    },
    format: (value: number) => this.display(value),
  });

  protected override readonly visibleErrors = computed(() => (this.errors().length ? this.errors() : this.raw.parseErrors()));

  /**
   * The text is not reformatted on focus (that would collapse a selection made
   * by the visitor or by autofill); it is regrouped on blur, unless invalid text
   * is kept for correction.
   */
  protected regroup(): void {
    if (this.raw.parseErrors().length === 0) this.raw.set(this.display(this.value()));
  }

  /** Reads the locale reactively, so the formatted text follows language switches. */
  private display(value: number): string {
    if (!Number.isFinite(value)) return '';
    return new Intl.NumberFormat(this.language.locale(), { maximumFractionDigits: 2 }).format(value);
  }
}
