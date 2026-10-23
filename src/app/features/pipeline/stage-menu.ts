import { CdkMenu, CdkMenuItem, CdkMenuItemRadio, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { Deal, DEAL_STAGES } from '../../core/models';
import { STAGE_COLOR_VAR } from '../../shared/domain/domain-badges';
import { RecordActions } from '../../shared/domain/record-actions';

/**
 * Deal actions menu — the keyboard/touch alternative to drag & drop
 * ("Move to" any stage), plus open, edit and delete.
 */
@Component({
  selector: 'app-deal-menu',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItem, CdkMenuItemRadio, LucideDynamicIcon, TranslatePipe],
  template: `
    <button
      type="button"
      class="btn btn-ghost btn-icon btn-sm"
      [cdkMenuTriggerFor]="menu"
      [attr.aria-label]="'common.rowActions' | translate: { name: deal().name }"
      (pointerdown)="$event.stopPropagation()"
      (click)="$event.stopPropagation()"
      data-testid="deal-menu"
    >
      <svg lucideIcon="ellipsis" aria-hidden="true"></svg>
    </button>

    <ng-template #menu>
      <div cdkMenu class="menu-panel w-56">
        <button cdkMenuItem class="menu-item" (cdkMenuItemTriggered)="open()">
          <svg lucideIcon="arrow-up-right" class="rtl-flip text-fg-muted" aria-hidden="true"></svg>
          {{ 'pipeline.openDeal' | translate }}
        </button>
        <button cdkMenuItem class="menu-item" (cdkMenuItemTriggered)="actions.editDeal(deal())">
          <svg lucideIcon="pencil" class="text-fg-muted" aria-hidden="true"></svg>{{ 'common.edit' | translate }}
        </button>
        <div class="menu-separator" role="separator"></div>
        <p class="menu-label">{{ 'pipeline.moveTo' | translate }}</p>
        @for (stage of stages; track stage) {
          <button
            cdkMenuItemRadio
            class="menu-item"
            [cdkMenuItemChecked]="deal().stage === stage"
            [cdkMenuItemDisabled]="deal().stage === stage"
            (cdkMenuItemTriggered)="actions.moveDeal(deal(), stage)"
            [attr.data-testid]="'move-to-' + stage"
          >
            <span class="size-2 rounded-full" [style.background]="color[stage]" aria-hidden="true"></span>
            <span class="flex-1">{{ 'enums.stage.' + stage | translate }}</span>
            @if (deal().stage === stage) {
              <svg lucideIcon="check" [size]="14" class="text-primary" aria-hidden="true"></svg>
            }
          </button>
        }
        <div class="menu-separator" role="separator"></div>
        <button cdkMenuItem class="menu-item is-danger" (cdkMenuItemTriggered)="actions.deleteDeal(deal())">
          <svg lucideIcon="trash" aria-hidden="true"></svg>{{ 'common.delete' | translate }}
        </button>
      </div>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DealMenu {
  private readonly router = inject(Router);
  protected readonly actions = inject(RecordActions);
  readonly deal = input.required<Deal>();
  protected readonly stages = DEAL_STAGES;
  protected readonly color = STAGE_COLOR_VAR;

  protected open(): void {
    void this.router.navigate(['/deals', this.deal().id]);
  }
}
