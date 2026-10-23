import { afterEveryRender, Directive, ElementRef, inject, input } from '@angular/core';

/**
 * Sets a native `<select>`'s value after its options have rendered. A plain
 * `[value]` binding runs before `@for` options exist, so the browser falls back
 * to the first option — visible when returning to a page with an active filter.
 */
@Directive({ selector: 'select[uiValue]' })
export class SelectValue {
  private readonly element = inject<ElementRef<HTMLSelectElement>>(ElementRef).nativeElement;
  readonly uiValue = input.required<string | number>();

  constructor() {
    afterEveryRender(() => {
      const value = String(this.uiValue());
      if (this.element.value !== value) this.element.value = value;
    });
  }
}
