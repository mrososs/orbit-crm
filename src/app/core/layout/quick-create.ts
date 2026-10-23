import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { QuickCreateService } from './quick-create.service';

@Component({
  selector: 'app-quick-create',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItem, LucideDynamicIcon, TranslatePipe],
  template: `
    <button
      type="button"
      class="btn btn-primary btn-sm"
      [class.btn-icon]="compact()"
      [cdkMenuTriggerFor]="menu"
      [attr.aria-label]="'quickCreate.label' | translate"
      data-testid="quick-create"
    >
      <svg lucideIcon="plus" [size]="16" aria-hidden="true"></svg>
      @if (!compact()) {
        <span>{{ 'common.new' | translate }}</span>
      }
    </button>
    <ng-template #menu>
      <div cdkMenu class="menu-panel w-56">
        <button cdkMenuItem class="menu-item" (cdkMenuItemTriggered)="create.deal()">
          <svg lucideIcon="briefcase" class="text-fg-muted" aria-hidden="true"></svg>
          {{ 'quickCreate.deal' | translate }}
        </button>
        <button cdkMenuItem class="menu-item" (cdkMenuItemTriggered)="create.contact()">
          <svg lucideIcon="user-plus" class="text-fg-muted" aria-hidden="true"></svg>
          {{ 'quickCreate.contact' | translate }}
        </button>
        <button cdkMenuItem class="menu-item" (cdkMenuItemTriggered)="create.company()">
          <svg lucideIcon="building" class="text-fg-muted" aria-hidden="true"></svg>
          {{ 'quickCreate.company' | translate }}
        </button>
        <div class="menu-separator" role="separator"></div>
        <button cdkMenuItem class="menu-item" (cdkMenuItemTriggered)="create.activity()">
          <svg lucideIcon="calendar-check" class="text-fg-muted" aria-hidden="true"></svg>
          {{ 'quickCreate.activity' | translate }}
        </button>
      </div>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickCreate {
  protected readonly create = inject(QuickCreateService);
  readonly compact = input(false);
}
