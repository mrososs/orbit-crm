import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { SelectOption } from './select-option';

/**
 * The popup list shared by the dropdown and the searchable select
 * (`role="listbox"`). Focus stays on the owning control, which points at the
 * highlighted option with `aria-activedescendant`.
 */
@Component({
  selector: 'ui-listbox-panel',
  imports: [LucideDynamicIcon],
  template: `
    <div class="menu-panel max-h-64 w-full overflow-y-auto p-1" [attr.data-testid]="testId() ? testId() + '-panel' : null">
      <ul role="listbox" [id]="listboxId()" [attr.aria-label]="label()">
        @for (option of options(); track option.value; let i = $index) {
          <!-- Options are not focusable by design: focus stays on the combobox, which handles the keys (aria-activedescendant). -->
          <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
          <li
            role="option"
            class="menu-item cursor-pointer"
            [class.bg-surface-hover]="i === activeIndex()"
            [class.opacity-50]="option.disabled"
            [class.text-fg-muted]="option.value === '' && placeholderMuted()"
            [id]="optionIdPrefix() + i"
            [attr.aria-selected]="option.value === selectedValue()"
            [attr.aria-disabled]="option.disabled || null"
            [attr.data-testid]="testId() ? testId() + '-option' : null"
            [attr.data-value]="option.value"
            (mousedown)="$event.preventDefault()"
            (mousemove)="activate.emit(i)"
            (click)="pick.emit(option)"
          >
            <span class="min-w-0 flex-1">
              <span class="block truncate">{{ option.label }}</span>
              @if (option.description) {
                <span class="block truncate text-xs text-fg-muted">{{ option.description }}</span>
              }
            </span>
            @if (option.value === selectedValue()) {
              <svg lucideIcon="check" [size]="15" class="shrink-0 text-primary" aria-hidden="true"></svg>
            }
          </li>
        }
      </ul>
      @if (options().length === 0) {
        <p class="px-2.5 py-2 text-sm text-fg-muted">{{ emptyText() }}</p>
      }
    </div>
  `,
  host: { class: 'block w-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListboxPanel {
  readonly options = input.required<readonly SelectOption[]>();
  readonly activeIndex = input(-1);
  readonly selectedValue = input('');
  readonly listboxId = input.required<string>();
  readonly optionIdPrefix = input.required<string>();
  readonly label = input('');
  readonly testId = input<string | null>(null);
  readonly emptyText = input('');
  /** Renders the empty-value option (a placeholder such as "No contact") in a muted tone. */
  readonly placeholderMuted = input(false);

  readonly pick = output<SelectOption>();
  readonly activate = output<number>();
}
