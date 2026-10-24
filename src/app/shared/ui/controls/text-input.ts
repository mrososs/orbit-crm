import { ChangeDetectionStrategy, Component, computed, ElementRef, input, model, signal, viewChild } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { FormFieldShell } from '../form-field';
import { ControlBase } from './control-base';

export type TextInputType = 'text' | 'email' | 'tel' | 'url' | 'password' | 'search';

/** Content that is always read left-to-right, even in RTL layouts. */
const LTR_TYPES: ReadonlySet<TextInputType> = new Set(['email', 'tel', 'url']);

/**
 * Single-line text control (text, email, phone, URL, password, search) built on a
 * native `<input>`, so browser autofill, IME and mobile keyboards keep working.
 *
 * `<ui-text-input [formField]="form.email" type="email" [label]="…" testId="contact-email" />`
 */
@Component({
  selector: 'ui-text-input',
  imports: [FormFieldShell, LucideDynamicIcon, TranslatePipe],
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
        @if (icon()) {
          <svg
            [lucideIcon]="icon()!"
            [size]="15"
            class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-subtle"
            aria-hidden="true"
          ></svg>
        }
        <input
          #control
          class="control"
          [class.ps-9]="!!icon()"
          [class.pe-10]="trailing()"
          [id]="controlId()"
          [type]="nativeType()"
          [value]="value()"
          [disabled]="disabled()"
          [readOnly]="readonly()"
          [attr.name]="name() || null"
          [attr.placeholder]="placeholder() || null"
          [attr.autocomplete]="autocomplete()"
          [attr.inputmode]="inputmode()"
          [attr.dir]="ltr() ? 'ltr' : null"
          [attr.maxlength]="maxLength() ?? null"
          [attr.aria-required]="required() || null"
          [attr.aria-invalid]="showErrors() || null"
          [attr.aria-describedby]="describedBy()"
          [attr.aria-busy]="pending() || null"
          [attr.data-testid]="testId()"
          (input)="onInput($event)"
          (blur)="markTouched()"
        />
        @if (pending()) {
          <svg
            lucideIcon="loader-circle"
            [size]="15"
            class="absolute end-3 top-1/2 -translate-y-1/2 animate-spin text-fg-subtle"
            aria-hidden="true"
          ></svg>
        } @else if (type() === 'password') {
          <button
            type="button"
            class="btn btn-ghost btn-icon btn-sm absolute end-1 top-1/2 -translate-y-1/2"
            [attr.aria-label]="(revealed() ? 'controls.hidePassword' : 'controls.showPassword') | translate"
            [attr.aria-pressed]="revealed()"
            [attr.aria-controls]="controlId()"
            [disabled]="disabled()"
            (click)="revealed.set(!revealed())"
          >
            <svg [lucideIcon]="revealed() ? 'eye-off' : 'eye'" [size]="15" aria-hidden="true"></svg>
          </button>
        }
      </div>
    </ui-form-field>
  `,
  host: { class: 'block min-w-0', '[hidden]': 'hidden()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextInput extends ControlBase implements FormValueControl<string> {
  readonly value = model('');
  readonly type = input<TextInputType>('text');
  /** Leading Lucide icon name. */
  readonly icon = input<string | null>(null);
  readonly autocomplete = input<string | null>(null);
  readonly inputmode = input<string | null>(null);
  /** Bound from a `maxLength()` validator. */
  readonly maxLength = input<number | undefined>(undefined);

  protected readonly control = viewChild<ElementRef<HTMLInputElement>>('control');
  protected readonly revealed = signal(false);
  protected readonly ltr = computed(() => LTR_TYPES.has(this.type()));
  protected readonly trailing = computed(() => this.pending() || this.type() === 'password');
  protected readonly nativeType = computed(() => (this.type() === 'password' && this.revealed() ? 'text' : this.type()));

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }
}
