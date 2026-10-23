import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

export interface SortState<K extends string = string> {
  key: K;
  direction: 'asc' | 'desc';
}

/** Sortable column header button. Place inside `<th [attr.aria-sort]>`. */
@Component({
  selector: 'ui-sort-header',
  imports: [LucideDynamicIcon, TranslatePipe],
  template: `
    <button
      type="button"
      class="-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-1 hover:bg-surface-hover hover:text-fg"
      [class.text-fg]="active()"
      (click)="toggle()"
      [attr.aria-label]="('table.sortBy' | translate: { column: label() }) + (active() ? ', ' + ((sort().direction === 'asc' ? 'table.sortedAscending' : 'table.sortedDescending') | translate) : '')"
    >
      {{ label() }}
      <svg
        [lucideIcon]="!active() ? 'chevrons-up-down' : sort().direction === 'asc' ? 'arrow-up' : 'arrow-down'"
        [size]="12"
        [class.opacity-40]="!active()"
        aria-hidden="true"
      ></svg>
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortHeader {
  readonly key = input.required<string>();
  readonly label = input.required<string>();
  readonly sort = model.required<SortState>();
  readonly defaultDirection = input<'asc' | 'desc'>('asc');

  protected readonly active = computed(() => this.sort().key === this.key());

  protected toggle(): void {
    if (this.active()) {
      this.sort.set({ key: this.key(), direction: this.sort().direction === 'asc' ? 'desc' : 'asc' });
    } else {
      this.sort.set({ key: this.key(), direction: this.defaultDirection() });
    }
  }
}

export function ariaSort(sort: SortState, key: string): 'ascending' | 'descending' | 'none' {
  if (sort.key !== key) return 'none';
  return sort.direction === 'asc' ? 'ascending' : 'descending';
}
