import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { Select } from './controls/select';

@Component({
  selector: 'ui-paginator',
  imports: [Select, LucideDynamicIcon, TranslatePipe],
  template: `
    <p class="text-[0.8125rem] text-fg-muted tabular" aria-live="polite">
      {{ 'table.showing' | translate: { from: from(), to: to(), total: total() } }}
    </p>
    <div class="flex items-center gap-3">
      <div class="hidden items-center gap-2 text-[0.8125rem] text-fg-muted sm:flex">
        <span aria-hidden="true">{{ 'table.rowsPerPage' | translate }}</span>
        <ui-select
          size="sm"
          class="w-[4.75rem]"
          testId="page-size"
          [ariaLabel]="'table.rowsPerPage' | translate"
          [options]="sizeOptions()"
          [value]="'' + pageSize()"
          (valueChange)="setSize($event)"
        />
      </div>
      <span class="text-[0.8125rem] text-fg-muted tabular">
        {{ 'table.pageOf' | translate: { page: page() + 1, pages: pages() } }}
      </span>
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="btn btn-secondary btn-icon btn-sm"
          [disabled]="page() === 0"
          (click)="page.set(page() - 1)"
          [attr.aria-label]="'table.previousPage' | translate"
        >
          <svg lucideIcon="chevron-left" class="rtl-flip" aria-hidden="true"></svg>
        </button>
        <button
          type="button"
          class="btn btn-secondary btn-icon btn-sm"
          [disabled]="page() >= pages() - 1"
          (click)="page.set(page() + 1)"
          [attr.aria-label]="'table.nextPage' | translate"
          data-testid="next-page"
        >
          <svg lucideIcon="chevron-right" class="rtl-flip" aria-hidden="true"></svg>
        </button>
      </div>
    </div>
  `,
  host: { class: 'flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Paginator {
  readonly total = input.required<number>();
  readonly page = model(0);
  readonly pageSize = model(10);
  readonly sizes = input([10, 25, 50]);

  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  protected readonly from = computed(() => (this.total() === 0 ? 0 : this.page() * this.pageSize() + 1));
  protected readonly to = computed(() => Math.min(this.total(), (this.page() + 1) * this.pageSize()));

  protected readonly sizeOptions = computed(() => this.sizes().map((size) => ({ value: String(size), label: String(size) })));

  protected setSize(value: string): void {
    this.pageSize.set(Number(value));
    this.page.set(0);
  }
}
