import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { CatalogComponent, Child, ComponentHostComponent } from '@a2ui/angular';
import { LucideDynamicIcon } from '@lucide/angular';
import { CardApi, ColumnApi, GridApi, RowApi } from '../../schemas/a2ui.schemas';

/** Children render through the official A2UI component host (catalog lookup + prop binding). */
const trackChild = (_: number, child: Child) => `${child.basePath}/${child.id}`;

@Component({
  selector: 'app-a2ui-column',
  imports: [ComponentHostComponent],
  template: `
    @for (child of children(); track trackChild($index, child)) {
      <a2ui-v09-component-host [componentKey]="child" [surfaceId]="surfaceId()" />
    }
  `,
  host: { class: 'flex min-w-0 flex-col', '[class]': 'gapClass()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class A2Column extends CatalogComponent<typeof ColumnApi> {
  protected readonly trackChild = trackChild;
  protected readonly children = computed(() => this.props()['children']?.value() ?? []);
  protected readonly gapClass = computed(() => ({ sm: 'gap-2', md: 'gap-3', lg: 'gap-5' })[this.props()['gap']?.value() ?? 'md']);
}

@Component({
  selector: 'app-a2ui-row',
  imports: [ComponentHostComponent],
  template: `
    @for (child of children(); track trackChild($index, child)) {
      <a2ui-v09-component-host [componentKey]="child" [surfaceId]="surfaceId()" />
    }
  `,
  host: { class: 'flex min-w-0 flex-wrap items-center gap-2', '[class.justify-between]': 'justify() === "between"', '[class.justify-end]': 'justify() === "end"' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class A2Row extends CatalogComponent<typeof RowApi> {
  protected readonly trackChild = trackChild;
  protected readonly children = computed(() => this.props()['children']?.value() ?? []);
  protected readonly justify = computed(() => this.props()['justify']?.value() ?? 'start');
}

@Component({
  selector: 'app-a2ui-grid',
  imports: [ComponentHostComponent],
  template: `
    @for (child of children(); track trackChild($index, child)) {
      <a2ui-v09-component-host class="min-w-0" [componentKey]="child" [surfaceId]="surfaceId()" />
    }
  `,
  host: { class: 'grid min-w-0 gap-3', '[class]': 'columnsClass()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class A2Grid extends CatalogComponent<typeof GridApi> {
  protected readonly trackChild = trackChild;
  protected readonly children = computed(() => this.props()['children']?.value() ?? []);
  /** The panel is narrow, so three and four columns collapse to two on small widths. */
  protected readonly columnsClass = computed(
    () => ({ 2: 'grid-cols-1 min-[360px]:grid-cols-2', 3: 'grid-cols-2 sm:grid-cols-3', 4: 'grid-cols-2 lg:grid-cols-4' })[this.props()['columns']?.value() ?? 2],
  );
}

@Component({
  selector: 'app-a2ui-card',
  imports: [ComponentHostComponent, LucideDynamicIcon],
  template: `
    @if (title()) {
      <div class="mb-3 flex items-start gap-2.5">
        @if (icon()) {
          <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-fg" aria-hidden="true">
            <svg [lucideIcon]="icon()!" [size]="15"></svg>
          </span>
        }
        <div class="min-w-0">
          <p class="text-sm font-semibold text-fg">{{ title() }}</p>
          @if (subtitle()) {
            <p class="text-xs text-fg-muted">{{ subtitle() }}</p>
          }
        </div>
      </div>
    }
    @if (child(); as c) {
      <a2ui-v09-component-host [componentKey]="c" [surfaceId]="surfaceId()" />
    }
  `,
  host: { class: 'block min-w-0 rounded-xl border border-line bg-surface p-3.5 shadow-xs' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class A2Card extends CatalogComponent<typeof CardApi> {
  protected readonly child = computed(() => this.props()['child']?.value());
  protected readonly title = computed(() => this.props()['title']?.value() ?? '');
  protected readonly subtitle = computed(() => this.props()['subtitle']?.value() ?? '');
  protected readonly icon = computed(() => this.props()['icon']?.value() ?? null);
}
