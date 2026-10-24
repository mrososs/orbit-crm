import { booleanAttribute, ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, model, viewChild } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { formatDate } from '../../../core/i18n/locale.utils';
import { CLOCK } from '../../../core/services/platform';
import { addDays, toIsoDate } from '../../utils/date';
import { FormFieldShell } from '../form-field';
import { ControlBase } from './control-base';

const SHORTCUTS = [
  { days: 0, label: 'controls.date.today' },
  { days: 1, label: 'controls.date.tomorrow' },
  { days: 7, label: 'controls.date.nextWeek' },
] as const;

/**
 * Date (`yyyy-mm-dd`) or time (`HH:mm`) control on the native input, which keeps
 * the platform calendar/clock pickers, keyboard entry and mobile wheels.
 *
 * Native pickers format dates in the *browser's* locale, so the control echoes
 * the chosen value in the *application's* language underneath ("Thursday,
 * 30 October 2026" / "الخميس، 30 أكتوبر 2026"), and offers quick picks.
 */
@Component({
  selector: 'ui-date-picker',
  imports: [FormFieldShell, TranslatePipe],
  template: `
    <ui-form-field
      [for]="controlId()"
      [label]="label()"
      [hint]="effectiveHint()"
      [optional]="optional() ? ('common.optional' | translate) : ''"
      [errors]="visibleErrors()"
      [showErrors]="showErrors()"
    >
      <input
        #control
        class="control tabular"
        [type]="type()"
        [id]="controlId()"
        [value]="value()"
        [disabled]="disabled()"
        [readOnly]="readonly()"
        [attr.min]="minDate() || null"
        [attr.max]="maxDate() || null"
        [attr.name]="name() || null"
        [attr.aria-required]="required() || null"
        [attr.aria-invalid]="showErrors() || null"
        [attr.aria-describedby]="describedBy()"
        [attr.data-testid]="testId()"
        (input)="value.set($any($event.target).value)"
        (change)="value.set($any($event.target).value)"
        (blur)="markTouched()"
      />
      @if (shortcuts() && type() === 'date' && !disabled() && !readonly()) {
        <div class="mt-2 flex flex-wrap gap-1.5" role="group" [attr.aria-label]="'controls.date.shortcuts' | translate">
          @for (shortcut of shortcutOptions(); track shortcut.label) {
            <button
              type="button"
              class="btn btn-secondary btn-sm h-7"
              [attr.aria-pressed]="value() === shortcut.value"
              [attr.data-testid]="testId() ? testId() + '-shortcut-' + shortcut.days : null"
              (click)="choose(shortcut.value)"
            >
              {{ shortcut.label | translate }}
            </button>
          }
        </div>
      }
    </ui-form-field>
  `,
  host: { class: 'block min-w-0', '[hidden]': 'hidden()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatePicker extends ControlBase implements FormValueControl<string> {
  private readonly language = inject(LanguageService);
  private readonly clock = inject(CLOCK);

  readonly value = model('');
  readonly type = input<'date' | 'time'>('date');
  /** Earliest / latest selectable date (`yyyy-mm-dd`). */
  readonly minDate = input('');
  readonly maxDate = input('');
  /** Shows Today / Tomorrow / In a week quick picks. */
  readonly shortcuts = input(false, { transform: booleanAttribute });

  protected readonly control = viewChild<ElementRef<HTMLInputElement>>('control');

  protected readonly shortcutOptions = computed(() => {
    const today = this.clock();
    return SHORTCUTS.map((s) => ({ ...s, value: toIsoDate(addDays(today, s.days)) }));
  });

  /** The value spelled out in the application's language. */
  private readonly echo = computed(() => {
    const value = this.value();
    const locale = this.language.locale();
    if (this.type() === 'time') {
      return /^\d{2}:\d{2}/.test(value) ? formatDate(new Date(`2000-01-01T${value.slice(0, 5)}:00`), locale, 'time') : '';
    }
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDate(value, locale, 'full') : '';
  });

  protected readonly effectiveHint = computed(() => this.echo() || this.hint());

  protected override hasHint(): boolean {
    return !!this.effectiveHint();
  }

  protected choose(value: string): void {
    this.value.set(value);
    this.markTouched();
  }
}
