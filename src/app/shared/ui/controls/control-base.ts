import { booleanAttribute, computed, Directive, ElementRef, input, model, Signal } from '@angular/core';
import type { ValidationError } from '@angular/forms/signals';
import type { ValidationLike } from '../form-field';

let nextId = 0;

/**
 * Inputs shared by every Orbit form control.
 *
 * The second group mirrors Signal Forms' `FormUiControl` contract: when a control
 * is bound with `[formField]`, the directive keeps `errors`, `disabled`,
 * `readonly`, `required`, `touched`… in sync with the field state, and listens to
 * `touchedChange` to mark the field as touched. The same controls also work
 * unbound (e.g. inside A2UI surfaces) by setting those inputs directly.
 */
@Directive()
export abstract class ControlBase {
  // ── Presentation ────────────────────────────────────────────────────
  readonly label = input('');
  readonly hint = input('');
  /** Shows the translated "Optional" marker next to the label. */
  readonly optional = input(false, { transform: booleanAttribute });
  readonly placeholder = input('');
  /** Id of the native control (not the host element); generated when omitted. */
  readonly inputId = input('');
  /** `data-testid` applied to the native control. */
  readonly testId = input<string | null>(null);
  /** Options or data are still loading. */
  readonly loading = input(false, { transform: booleanAttribute });

  // ── FormUiControl (bound by [formField]) ────────────────────────────
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly pending = input(false, { transform: booleanAttribute });
  readonly hidden = input(false, { transform: booleanAttribute });
  readonly dirty = input(false, { transform: booleanAttribute });
  readonly name = input('');
  readonly touched = model(false);

  /** The focusable native element. */
  protected abstract readonly control: Signal<ElementRef<HTMLElement> | undefined>;

  private readonly generatedId = `ui-control-${++nextId}`;
  protected readonly controlId = computed(() => this.inputId() || this.generatedId);

  /** Errors to display; controls with local parse errors extend this. */
  protected readonly visibleErrors: Signal<readonly ValidationLike[]> = computed(() => this.errors());

  /** Errors are revealed once the field was touched (blur or submit attempt). */
  protected readonly showErrors = computed(() => this.touched() && this.visibleErrors().length > 0);

  protected readonly describedBy = computed(() => {
    if (this.showErrors()) return `${this.controlId()}-error`;
    return this.hasHint() ? `${this.controlId()}-hint` : null;
  });

  /** Whether a hint element is rendered (subclasses may derive their own hint). */
  protected hasHint(): boolean {
    return !!this.hint();
  }

  protected markTouched(): void {
    if (!this.touched()) this.touched.set(true);
  }

  /** Used by Signal Forms to focus the bound control (e.g. `focusBoundControl()`). */
  focus(options?: FocusOptions): void {
    this.control()?.nativeElement.focus(options);
  }
}
