import { ChangeDetectionStrategy, Component, ElementRef, inject, input, model } from '@angular/core';
import { LanguageService } from '../../core/i18n/language.service';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

/**
 * Accessible tab list (WAI-ARIA tabs pattern) with roving tabindex. Arrow keys
 * follow the reading direction. The owner renders the matching `role="tabpanel"`.
 */
@Component({
  selector: 'ui-tabs',
  template: `
    <div role="tablist" class="flex gap-1 overflow-x-auto" [attr.aria-label]="label()">
      @for (tab of tabs(); track tab.id) {
        <button
          type="button"
          role="tab"
          [id]="idPrefix() + '-tab-' + tab.id"
          [attr.aria-selected]="active() === tab.id"
          [attr.aria-controls]="idPrefix() + '-panel'"
          [tabIndex]="active() === tab.id ? 0 : -1"
          (click)="active.set(tab.id)"
          (keydown)="onKeydown($event)"
          class="group relative inline-flex h-10 shrink-0 items-center gap-2 px-3 text-sm font-medium whitespace-nowrap text-fg-muted transition-colors hover:text-fg aria-selected:text-fg"
        >
          {{ tab.label }}
          @if (tab.count !== undefined) {
            <span
              class="rounded-full bg-surface-sunken px-1.5 py-px text-2xs font-semibold text-fg-muted tabular group-aria-selected:bg-primary-soft group-aria-selected:text-primary-soft-fg"
              >{{ tab.count }}</span
            >
          }
          <span
            class="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary transition-opacity"
            [class.opacity-0]="active() !== tab.id"
            aria-hidden="true"
          ></span>
        </button>
      }
    </div>
  `,
  host: { class: 'block border-b border-line' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tabs {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly language = inject(LanguageService);

  readonly tabs = input.required<TabItem[]>();
  readonly active = model.required<string>();
  readonly idPrefix = input('tabs');
  readonly label = input<string>('');

  protected onKeydown(event: KeyboardEvent): void {
    const items = this.tabs();
    const index = items.findIndex((t) => t.id === this.active());
    const forward = this.language.isRtl() ? 'ArrowLeft' : 'ArrowRight';
    const backward = this.language.isRtl() ? 'ArrowRight' : 'ArrowLeft';
    let next = index;
    if (event.key === forward) next = (index + 1) % items.length;
    else if (event.key === backward) next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return;

    event.preventDefault();
    this.active.set(items[next].id);
    queueMicrotask(() =>
      this.host.nativeElement.querySelector<HTMLElement>(`#${this.idPrefix()}-tab-${items[next].id}`)?.focus(),
    );
  }
}
