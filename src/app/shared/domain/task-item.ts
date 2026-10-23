import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { isActivityOverdue } from '../../core/domain/activity-rules';
import { Activity, fullName } from '../../core/models';
import { CLOCK } from '../../core/services/platform';
import { ContactsStore, DealsStore } from '../../state/entity-stores';
import { LocalDatePipe, RelativeDayPipe } from '../pipes/locale-pipes';
import { ActivityIcon, OwnerChip, PriorityBadge } from './domain-badges';
import { RecordActions } from './record-actions';

/** A task row: completion toggle, type, subject, related records, due date and actions. */
@Component({
  selector: 'app-task-item',
  imports: [
    RouterLink,
    LucideDynamicIcon,
    TranslatePipe,
    CdkMenu,
    CdkMenuItem,
    CdkMenuTrigger,
    ActivityIcon,
    OwnerChip,
    PriorityBadge,
    LocalDatePipe,
    RelativeDayPipe,
  ],
  template: `
    <button
      type="button"
      role="checkbox"
      [attr.aria-checked]="done()"
      class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors"
      [class]="done() ? 'border-success bg-success text-white' : 'border-line-strong text-transparent hover:border-success hover:text-success'"
      (click)="actions.toggleActivity(activity())"
      [attr.aria-label]="(done() ? 'activities.markIncomplete' : 'activities.markComplete') | translate: { subject: activity().subject }"
      data-testid="task-toggle"
    >
      <svg lucideIcon="check" [size]="12" [strokeWidth]="3" aria-hidden="true"></svg>
    </button>

    <app-activity-icon class="hidden sm:inline-flex" [type]="activity().type" size="sm" />

    <div class="min-w-0 flex-1">
      <p
        class="text-sm leading-5 font-medium text-fg"
        [class.line-through]="done()"
        [class.text-fg-subtle]="done()"
        data-testid="task-subject"
      >
        {{ activity().subject }}
      </p>
      <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
        <span class="inline-flex items-center gap-1 sm:hidden">{{ 'enums.activityType.' + activity().type | translate }}</span>
        @if (done()) {
          <span class="inline-flex items-center gap-1">
            <svg lucideIcon="circle-check" [size]="12" aria-hidden="true"></svg>
            {{ 'activities.completedOn' | translate: { date: (activity().completedAt | localDate: 'dayMonth') } }}
          </span>
        } @else {
          <span class="inline-flex items-center gap-1" [class.text-danger]="overdue()" [class.font-medium]="overdue()">
            <svg [lucideIcon]="overdue() ? 'circle-alert' : 'clock'" [size]="12" aria-hidden="true"></svg>
            <span>{{ activity().dueAt | relativeDay }}</span>
            <span class="text-fg-subtle tabular">· {{ activity().dueAt | localDate: 'time' }}</span>
          </span>
        }
        @if (contact(); as c) {
          <a [routerLink]="['/contacts', c.id]" class="inline-flex max-w-48 items-center gap-1 truncate hover:text-primary">
            <svg lucideIcon="user" [size]="12" aria-hidden="true"></svg>{{ c.name }}
          </a>
        }
        @if (deal(); as d) {
          <a [routerLink]="['/deals', d.id]" class="inline-flex max-w-56 items-center gap-1 truncate hover:text-primary">
            <svg lucideIcon="briefcase" [size]="12" aria-hidden="true"></svg>{{ d.name }}
          </a>
        }
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      @if (!done() && showPriority()) {
        <app-priority-badge class="hidden md:inline-flex" [priority]="activity().priority" />
      }
      @if (showOwner()) {
        <app-owner [ownerId]="activity().ownerId" [showName]="false" />
      }
      <button
        type="button"
        class="btn btn-ghost btn-icon btn-sm"
        [cdkMenuTriggerFor]="menu"
        [attr.aria-label]="'common.rowActions' | translate: { name: activity().subject }"
      >
        <svg lucideIcon="ellipsis" aria-hidden="true"></svg>
      </button>
    </div>

    <ng-template #menu>
      <div cdkMenu class="menu-panel">
        <button cdkMenuItem class="menu-item" (cdkMenuItemTriggered)="actions.toggleActivity(activity())">
          <svg [lucideIcon]="done() ? 'rotate-ccw' : 'circle-check'" class="text-fg-muted" aria-hidden="true"></svg>
          {{ (done() ? 'activities.reopened' : 'activities.completed') | translate }}
        </button>
        <button cdkMenuItem class="menu-item" (cdkMenuItemTriggered)="actions.editActivity(activity())">
          <svg lucideIcon="pencil" class="text-fg-muted" aria-hidden="true"></svg>{{ 'common.edit' | translate }}
        </button>
        <div class="menu-separator" role="separator"></div>
        <button cdkMenuItem class="menu-item is-danger" (cdkMenuItemTriggered)="actions.deleteActivity(activity())">
          <svg lucideIcon="trash" aria-hidden="true"></svg>{{ 'common.delete' | translate }}
        </button>
      </div>
    </ng-template>
  `,
  host: {
    class: 'group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-hover',
    '[attr.data-overdue]': 'overdue()',
    'data-testid': 'task-item',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskItem {
  private readonly clock = inject(CLOCK);
  private readonly contacts = inject(ContactsStore);
  private readonly deals = inject(DealsStore);
  protected readonly actions = inject(RecordActions);

  readonly activity = input.required<Activity>();
  readonly showOwner = input(true);
  readonly showPriority = input(true);
  readonly showContact = input(true);
  readonly showDeal = input(true);

  protected readonly done = computed(() => this.activity().completedAt !== null);
  protected readonly overdue = computed(() => isActivityOverdue(this.activity(), this.clock()));
  protected readonly contact = computed(() => {
    const id = this.activity().contactId;
    const contact = id && this.showContact() ? this.contacts.entityMap()[id] : undefined;
    return contact ? { id: contact.id, name: fullName(contact) } : null;
  });
  protected readonly deal = computed(() => {
    const id = this.activity().dealId;
    const deal = id && this.showDeal() ? this.deals.entityMap()[id] : undefined;
    return deal ? { id: deal.id, name: deal.name } : null;
  });
}
