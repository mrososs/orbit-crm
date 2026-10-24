import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { matchesQuery } from '../../utils/text';
import { FormFieldShell } from '../form-field';
import { ListboxControl } from './listbox-control';
import { ListboxPanel } from './listbox-panel';
import { SelectOption } from './select-option';

/**
 * Searchable select following the WAI-ARIA combobox pattern (editable input,
 * list autocomplete, `aria-activedescendant`). Used for long lists — contacts,
 * companies, deals — where scrolling a dropdown becomes tedious.
 *
 * Keyboard: ↓/↑ open and move, Enter picks, Esc closes (without closing a
 * surrounding dialog), Tab leaves. Typing filters accent-insensitively on the
 * label and keywords; leaving the field restores the selected option's label.
 */
@Component({
  selector: 'ui-combobox',
  imports: [FormFieldShell, LucideDynamicIcon, TranslatePipe, ListboxPanel],
  template: `
    <ui-form-field
      [for]="controlId()"
      [label]="label()"
      [hint]="hint()"
      [optional]="optional() ? ('common.optional' | translate) : ''"
      [errors]="visibleErrors()"
      [showErrors]="showErrors()"
    >
      <div class="relative" #origin>
        <svg
          lucideIcon="search"
          [size]="15"
          class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-subtle"
          aria-hidden="true"
        ></svg>
        <input
          #control
          type="text"
          role="combobox"
          autocomplete="off"
          aria-autocomplete="list"
          class="control ps-9 pe-16"
          [id]="controlId()"
          [value]="inputText()"
          [disabled]="disabled() || loading()"
          [readOnly]="readonly()"
          [attr.name]="name() || null"
          [attr.placeholder]="placeholder() || null"
          [attr.aria-expanded]="open()"
          [attr.aria-controls]="listboxId()"
          [attr.aria-activedescendant]="activeOptionId()"
          [attr.aria-required]="required() || null"
          [attr.aria-invalid]="showErrors() || null"
          [attr.aria-describedby]="describedBy()"
          [attr.aria-busy]="loading() || null"
          [attr.data-testid]="testId()"
          [attr.data-value]="value()"
          (input)="onInput($event)"
          (keydown)="onKeydown($event)"
          (click)="openList()"
          (blur)="onBlur()"
        />
        <div class="absolute end-1 top-1/2 flex -translate-y-1/2 items-center">
          @if (loading()) {
            <svg lucideIcon="loader-circle" [size]="15" class="me-2 animate-spin text-fg-subtle" aria-hidden="true"></svg>
          } @else if (clearable() && value() && !disabled() && !readonly()) {
            <button
              type="button"
              class="btn btn-ghost btn-icon btn-sm size-7"
              [attr.aria-label]="'controls.clearSelection' | translate"
              [attr.data-testid]="testId() ? testId() + '-clear' : null"
              (click)="clear()"
            >
              <svg lucideIcon="x" [size]="14" aria-hidden="true"></svg>
            </button>
          }
          <button
            type="button"
            tabindex="-1"
            aria-hidden="true"
            class="btn btn-ghost btn-icon btn-sm size-7 text-fg-subtle"
            [disabled]="disabled() || readonly() || loading()"
            (mousedown)="$event.preventDefault()"
            (click)="toggleList()"
          >
            <svg lucideIcon="chevrons-up-down" [size]="14"></svg>
          </button>
        </div>
      </div>

      <ng-template #panel>
        <ui-listbox-panel
          [options]="visibleOptions()"
          [activeIndex]="activeIndex()"
          [selectedValue]="value()"
          [listboxId]="listboxId()"
          [optionIdPrefix]="optionIdPrefix()"
          [label]="label() || placeholder()"
          [testId]="testId()"
          [emptyText]="'controls.noResults' | translate"
          (pick)="choose($event)"
          (activate)="activeIndex.set($event)"
        />
      </ng-template>
      <span class="sr-only" aria-live="polite">{{ status() }}</span>
    </ui-form-field>
  `,
  host: { class: 'block min-w-0', '[hidden]': 'hidden()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Combobox extends ListboxControl {
  private readonly language = inject(LanguageService);

  /** Shows a button that resets the value to ''. */
  readonly clearable = input(false, { transform: booleanAttribute });

  protected readonly control = viewChild<ElementRef<HTMLInputElement>>('control');
  protected readonly origin = viewChild.required<ElementRef<HTMLElement>>('origin');
  protected readonly panel = viewChild.required<TemplateRef<unknown>>('panel');

  protected readonly query = signal('');
  /** True while the visitor is typing a query (the input shows the query, not the selection). */
  private readonly editing = signal(false);

  protected readonly inputText = computed(() => (this.editing() ? this.query() : (this.selected()?.label ?? '')));
  protected readonly visibleOptions = computed(() => {
    const q = this.editing() ? this.query() : '';
    return this.options().filter((o) => matchesQuery(q, o.label, o.keywords));
  });
  protected readonly status = computed(() =>
    this.open() ? this.language.plural('controls.resultCount', this.visibleOptions().length) : '',
  );

  protected toggleList(): void {
    if (this.open()) this.close();
    else {
      this.openList();
      this.focus();
    }
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.editing.set(true);
    this.openList('first');
  }

  protected onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        if (!this.open()) this.openList();
        else this.move(event.key === 'ArrowDown' ? 1 : -1);
        return;
      case 'Enter': {
        const option = this.open() ? this.visibleOptions()[this.activeIndex()] : undefined;
        if (option) {
          event.preventDefault();
          this.choose(option);
        }
        return;
      }
      case 'Escape':
        if (this.open() || this.editing()) {
          // Handled here so an enclosing dialog stays open.
          event.preventDefault();
          event.stopPropagation();
          this.close();
          this.editing.set(false);
        }
        return;
      case 'Tab':
        this.close();
        return;
    }
  }

  protected onBlur(): void {
    this.close();
    this.editing.set(false);
    this.markTouched();
  }

  protected choose(option: SelectOption): void {
    this.pick(option);
    this.editing.set(false);
  }

  protected clear(): void {
    this.value.set('');
    this.editing.set(false);
    this.markTouched();
    this.focus();
  }
}
