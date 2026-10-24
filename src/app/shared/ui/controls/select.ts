import { ChangeDetectionStrategy, Component, computed, ElementRef, input, TemplateRef, viewChild } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { normalize } from '../../utils/text';
import { FormFieldShell } from '../form-field';
import { ListboxControl } from './listbox-control';
import { ListboxPanel } from './listbox-panel';
import { SelectOption } from './select-option';

export type { SelectOption } from './select-option';

/**
 * Orbit dropdown — the WAI-ARIA "select-only combobox" pattern: a button with
 * `role="combobox"` that opens a styled listbox, so the list matches the design
 * system in every browser, theme and direction (a native `<select>` popup
 * cannot be styled).
 *
 * Keyboard: ↓/↑/Enter/Space open and move, Home/End jump, typing a few letters
 * jumps to the matching option, Enter/Space pick, Tab picks and leaves, Esc
 * closes (without closing a surrounding dialog). For long, searchable lists use
 * `ui-combobox`.
 *
 * `<ui-select [formField]="form.status" [label]="…" [options]="statusOptions()" />`
 */
@Component({
  selector: 'ui-select',
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
      <button
        #control
        #origin
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        class="control flex items-center gap-2 text-start"
        [class.control-sm]="size() === 'sm'"
        [class.cursor-default]="readonly()"
        [id]="controlId()"
        [disabled]="disabled() || loading()"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="listboxId()"
        [attr.aria-activedescendant]="activeOptionId()"
        [attr.aria-label]="ariaLabel() || null"
        [attr.aria-readonly]="readonly() || null"
        [attr.aria-required]="required() || null"
        [attr.aria-invalid]="showErrors() || null"
        [attr.aria-describedby]="describedBy()"
        [attr.aria-busy]="loading() || null"
        [attr.data-testid]="testId()"
        [attr.data-value]="value()"
        (click)="toggleList()"
        (keydown)="onKeydown($event)"
        (blur)="onBlur()"
      >
        <span class="min-w-0 flex-1 truncate" [class.text-fg-subtle]="!selected()">{{ displayLabel() }}</span>
        @if (loading()) {
          <svg lucideIcon="loader-circle" [size]="15" class="shrink-0 animate-spin text-fg-subtle" aria-hidden="true"></svg>
        } @else if (!readonly()) {
          <svg
            lucideIcon="chevron-down"
            [size]="15"
            class="shrink-0 text-fg-subtle transition-transform duration-150"
            [class.rotate-180]="open()"
            aria-hidden="true"
          ></svg>
        }
      </button>

      <ng-template #panel>
        <ui-listbox-panel
          [options]="visibleOptions()"
          [activeIndex]="activeIndex()"
          [selectedValue]="value()"
          [listboxId]="listboxId()"
          [optionIdPrefix]="optionIdPrefix()"
          [label]="label() || ariaLabel()"
          [testId]="testId()"
          [placeholderMuted]="true"
          (pick)="choose($event)"
          (activate)="activeIndex.set($event)"
        />
      </ng-template>
    </ui-form-field>
  `,
  host: { class: 'block min-w-0', '[hidden]': 'hidden()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Select extends ListboxControl {
  readonly size = input<'sm' | 'md'>('md');
  /** Accessible name when the select has no visible label (e.g. toolbar filters). */
  readonly ariaLabel = input('');

  protected readonly control = viewChild<ElementRef<HTMLButtonElement>>('control');
  protected readonly origin = viewChild.required<ElementRef<HTMLElement>>('origin');
  protected readonly panel = viewChild.required<TemplateRef<unknown>>('panel');

  /** A placeholder becomes a selectable empty option ("No contact"). */
  protected readonly visibleOptions = computed<readonly SelectOption[]>(() =>
    this.placeholder() ? [{ value: '', label: this.placeholder() }, ...this.options()] : this.options(),
  );
  protected readonly displayLabel = computed(() => this.selected()?.label ?? this.placeholder());

  private typeahead = '';
  private typeaheadTimer: ReturnType<typeof setTimeout> | undefined;

  protected toggleList(): void {
    if (this.open()) this.close();
    else this.openList();
  }

  protected choose(option: SelectOption): void {
    this.pick(option);
    this.markTouched();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.interactive) return;
    const open = this.open();
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        if (!open) this.openList();
        else if (event.altKey) this.pickActive();
        else this.move(event.key === 'ArrowDown' ? 1 : -1);
        return;
      case 'Home':
      case 'End':
        event.preventDefault();
        this.openList(event.key === 'Home' ? 'first' : 'last');
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (open) this.pickActive();
        else this.openList();
        return;
      case 'Escape':
        if (open) {
          // Handled here so an enclosing dialog or drawer stays open.
          event.preventDefault();
          event.stopPropagation();
          this.close();
        }
        return;
      case 'Tab':
        if (open) this.pickActive();
        return;
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) this.typeAhead(event.key);
    }
  }

  protected onBlur(): void {
    this.close();
    this.markTouched();
  }

  private pickActive(): void {
    const option = this.visibleOptions()[this.activeIndex()];
    if (option) this.choose(option);
    else this.close();
  }

  /** Jumps to the next option whose label starts with the typed characters. */
  private typeAhead(char: string): void {
    clearTimeout(this.typeaheadTimer);
    this.typeahead += normalize(char);
    this.typeaheadTimer = setTimeout(() => (this.typeahead = ''), 600);
    if (!this.open()) this.openList();
    const options = this.visibleOptions();
    const start = this.typeahead.length === 1 ? this.activeIndex() + 1 : Math.max(this.activeIndex(), 0);
    for (let n = 0; n < options.length; n++) {
      const i = (start + n) % options.length;
      if (!options[i].disabled && normalize(options[i].label).startsWith(this.typeahead)) {
        this.activeIndex.set(i);
        return;
      }
    }
  }
}
