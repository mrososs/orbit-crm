import { CdkMenu, CdkMenuItemRadio, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { RANGE_PRESETS } from '../../core/analytics/date-range';
import { RangePreset } from '../../core/services/preferences.service';

export interface RangeSelection {
  preset: RangePreset;
  start: string;
  end: string;
}

/** Period selector: preset menu plus optional custom start/end dates. */
@Component({
  selector: 'ui-range-filter',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItemRadio, LucideDynamicIcon, TranslatePipe],
  template: `
    <button
      type="button"
      class="btn btn-secondary btn-sm"
      [cdkMenuTriggerFor]="menu"
      [attr.aria-label]="('ranges.label' | translate) + ': ' + ('ranges.' + value().preset | translate)"
      data-testid="range-filter"
    >
      <svg lucideIcon="calendar-days" class="text-fg-muted" aria-hidden="true"></svg>
      {{ 'ranges.' + value().preset | translate }}
      <svg lucideIcon="chevron-down" [size]="14" class="text-fg-subtle" aria-hidden="true"></svg>
    </button>

    @if (value().preset === 'custom') {
      <div class="flex items-center gap-1.5">
        <label class="sr-only" for="range-start">{{ 'ranges.from' | translate }}</label>
        <input
          id="range-start"
          type="date"
          class="control control-sm w-[8.75rem]"
          [value]="value().start"
          [max]="value().end"
          (change)="emitCustom('start', $event)"
        />
        <span class="text-fg-subtle" aria-hidden="true">–</span>
        <label class="sr-only" for="range-end">{{ 'ranges.to' | translate }}</label>
        <input
          id="range-end"
          type="date"
          class="control control-sm w-[8.75rem]"
          [value]="value().end"
          [min]="value().start"
          (change)="emitCustom('end', $event)"
        />
      </div>
    }

    <ng-template #menu>
      <div cdkMenu class="menu-panel w-52">
        @for (preset of presets; track preset) {
          <button
            cdkMenuItemRadio
            class="menu-item"
            [cdkMenuItemChecked]="value().preset === preset"
            (cdkMenuItemTriggered)="changed.emit({ preset, start: value().start, end: value().end })"
          >
            <span class="flex-1">{{ 'ranges.' + preset | translate }}</span>
            @if (value().preset === preset) {
              <svg lucideIcon="check" [size]="15" class="text-primary" aria-hidden="true"></svg>
            }
          </button>
        }
        <div class="menu-separator" role="separator"></div>
        <button
          cdkMenuItemRadio
          class="menu-item"
          [cdkMenuItemChecked]="value().preset === 'custom'"
          (cdkMenuItemTriggered)="changed.emit({ preset: 'custom', start: value().start, end: value().end })"
        >
          <span class="flex-1">{{ 'ranges.custom' | translate }}</span>
          @if (value().preset === 'custom') {
            <svg lucideIcon="check" [size]="15" class="text-primary" aria-hidden="true"></svg>
          }
        </button>
      </div>
    </ng-template>
  `,
  host: { class: 'flex flex-wrap items-center gap-2' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RangeFilter {
  readonly value = input.required<RangeSelection>();
  readonly changed = output<RangeSelection>();
  protected readonly presets = RANGE_PRESETS;

  protected emitCustom(which: 'start' | 'end', event: Event): void {
    const date = (event.target as HTMLInputElement).value;
    if (!date) return;
    this.changed.emit({ ...this.value(), preset: 'custom', [which]: date });
  }
}
