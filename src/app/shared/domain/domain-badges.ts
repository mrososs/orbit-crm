import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import {
  ActivityType,
  ContactStatus,
  DealStage,
  fullName,
  Priority,
} from '../../core/models';
import { TeamStore } from '../../state/entity-stores';
import { Avatar, AvatarSize } from '../ui/avatar';
import { Badge, BadgeTone } from '../ui/badge';

export const STAGE_COLOR_VAR: Record<DealStage, string> = {
  new: 'var(--stage-new)',
  qualified: 'var(--stage-qualified)',
  proposal: 'var(--stage-proposal)',
  negotiation: 'var(--stage-negotiation)',
  won: 'var(--stage-won)',
  lost: 'var(--stage-lost)',
};

@Component({
  selector: 'app-stage-badge',
  imports: [Badge, TranslatePipe],
  template: `<ui-badge [tone]="tone()" [dotColor]="color()">{{ 'enums.stage.' + stage() | translate }}</ui-badge>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StageBadge {
  readonly stage = input.required<DealStage>();
  protected readonly color = computed(() => STAGE_COLOR_VAR[this.stage()]);
  protected readonly tone = computed<BadgeTone>(() =>
    this.stage() === 'won' ? 'success' : this.stage() === 'lost' ? 'danger' : 'neutral',
  );
}

const PRIORITY_TONE: Record<Priority, BadgeTone> = { high: 'danger', medium: 'warning', low: 'neutral' };

@Component({
  selector: 'app-priority-badge',
  imports: [Badge, TranslatePipe, LucideDynamicIcon],
  template: `
    <ui-badge [tone]="tone()">
      <svg lucideIcon="flag" [size]="11" aria-hidden="true"></svg>
      {{ 'enums.priority.' + priority() | translate }}
    </ui-badge>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriorityBadge {
  readonly priority = input.required<Priority>();
  protected readonly tone = computed(() => PRIORITY_TONE[this.priority()]);
}

const STATUS_TONE: Record<ContactStatus, BadgeTone> = {
  lead: 'info',
  prospect: 'primary',
  customer: 'success',
  churned: 'neutral',
};

@Component({
  selector: 'app-status-badge',
  imports: [Badge, TranslatePipe],
  template: `<ui-badge [tone]="tone()" dot>{{ 'enums.contactStatus.' + status() | translate }}</ui-badge>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadge {
  readonly status = input.required<ContactStatus>();
  protected readonly tone = computed(() => STATUS_TONE[this.status()]);
}

/** Team member avatar with optional name, resolved from the team store. */
@Component({
  selector: 'app-owner',
  imports: [Avatar],
  template: `
    @if (name(); as n) {
      <ui-avatar [name]="n" [size]="size()" />
      @if (showName()) {
        <span class="truncate text-sm text-fg">{{ n }}</span>
      }
    } @else {
      <span class="text-fg-subtle">—</span>
    }
  `,
  host: { class: 'inline-flex min-w-0 items-center gap-2' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OwnerChip {
  private readonly team = inject(TeamStore);
  readonly ownerId = input.required<string>();
  readonly size = input<AvatarSize>('sm');
  readonly showName = input(true);
  protected readonly name = computed(() => {
    const member = this.team.entityMap()[this.ownerId()];
    return member ? fullName(member) : null;
  });
}

export const ACTIVITY_ICON: Record<ActivityType, string> = {
  call: 'phone',
  meeting: 'video',
  email: 'mail',
  'follow-up': 'calendar-clock',
};

const ACTIVITY_TONE: Record<ActivityType, string> = {
  call: 'bg-info-soft text-info-soft-fg',
  meeting: 'bg-primary-soft text-primary-soft-fg',
  email: 'bg-warning-soft text-warning-soft-fg',
  'follow-up': 'bg-success-soft text-success-soft-fg',
};

@Component({
  selector: 'app-activity-icon',
  imports: [LucideDynamicIcon],
  template: `<svg [lucideIcon]="icon()" [size]="size() === 'sm' ? 13 : 15" aria-hidden="true"></svg>`,
  host: {
    '[class]': 'classes()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityIcon {
  readonly type = input.required<ActivityType>();
  readonly size = input<'sm' | 'md'>('md');
  protected readonly icon = computed(() => ACTIVITY_ICON[this.type()]);
  protected readonly classes = computed(
    () =>
      `inline-flex shrink-0 items-center justify-center rounded-lg ${this.size() === 'sm' ? 'size-6' : 'size-8'} ${ACTIVITY_TONE[this.type()]}`,
  );
}
