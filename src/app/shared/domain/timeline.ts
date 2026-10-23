import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { LanguageService } from '../../core/i18n/language.service';
import { Activity, Company, Contact, Deal, fullName, TimelineEvent, TimelineEventKind } from '../../core/models';
import {
  ActivitiesStore,
  CompaniesStore,
  ContactsStore,
  DealsStore,
  TeamStore,
} from '../../state/entity-stores';
import { RelativeTimePipe, LocalDatePipe } from '../pipes/locale-pipes';
import { Avatar } from '../ui/avatar';
import { EmptyState } from '../ui/empty-state';
import { RichSlot, RichText } from '../ui/rich-text';

const KIND_ICON: Record<TimelineEventKind, { icon: string; tone: string }> = {
  'deal-created': { icon: 'briefcase', tone: 'bg-primary-soft text-primary-soft-fg' },
  'deal-stage-changed': { icon: 'arrow-right-left', tone: 'bg-info-soft text-info-soft-fg' },
  'deal-won': { icon: 'trophy', tone: 'bg-success-soft text-success-soft-fg' },
  'deal-lost': { icon: 'circle-x', tone: 'bg-danger-soft text-danger-soft-fg' },
  'contact-created': { icon: 'user-plus', tone: 'bg-neutral-soft text-neutral-soft-fg' },
  'company-created': { icon: 'building', tone: 'bg-neutral-soft text-neutral-soft-fg' },
  'activity-completed': { icon: 'circle-check', tone: 'bg-success-soft text-success-soft-fg' },
};

interface TimelineRow {
  id: string;
  at: string;
  icon: string;
  tone: string;
  key: string;
  slots: Record<string, RichSlot>;
  actorName: string;
}

/** Vertical activity timeline / feed built from timeline events. */
@Component({
  selector: 'app-timeline',
  imports: [RichText, Avatar, LucideDynamicIcon, RelativeTimePipe, LocalDatePipe, EmptyState],
  template: `
    @if (rows().length === 0) {
      <ui-empty-state compact icon="activity" [heading]="emptyText()" />
    } @else {
      <ol class="relative">
        @for (row of rows(); track row.id; let last = $last) {
          <li class="relative flex gap-3 pb-5 last:pb-0">
            @if (!last) {
              <span class="absolute start-[0.9375rem] top-9 bottom-1 w-px bg-line" aria-hidden="true"></span>
            }
            <span class="relative z-[1] flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-surface {{ row.tone }}">
              <svg [lucideIcon]="row.icon" [size]="14" aria-hidden="true"></svg>
            </span>
            <div class="min-w-0 flex-1 pt-1">
              <p class="text-sm leading-5 text-fg-muted">
                <ui-rich-text [key]="row.key" [slots]="row.slots" />
              </p>
              <p class="mt-0.5 flex items-center gap-1.5 text-xs text-fg-subtle">
                @if (showActorAvatar()) {
                  <ui-avatar [name]="row.actorName" size="xs" />
                }
                <time [attr.datetime]="row.at" [title]="row.at | localDate: 'dateTime'">{{ row.at | relativeTime }}</time>
              </p>
            </div>
          </li>
        }
      </ol>
    }
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Timeline {
  private readonly language = inject(LanguageService);
  private readonly team = inject(TeamStore);
  private readonly deals = inject(DealsStore);
  private readonly contacts = inject(ContactsStore);
  private readonly companies = inject(CompaniesStore);
  private readonly activities = inject(ActivitiesStore);

  readonly events = input.required<TimelineEvent[]>();
  readonly limit = input(0);
  readonly emptyText = input('');
  readonly showActorAvatar = input(true);

  protected readonly rows = computed<TimelineRow[]>(() => {
    const t = (key: string) => this.language.t(key);
    const team = this.team.entityMap();
    const deals = this.deals.entityMap();
    const contacts = this.contacts.entityMap();
    const companies = this.companies.entityMap();
    const activities = this.activities.entityMap();
    const list = this.limit() > 0 ? this.events().slice(0, this.limit()) : this.events();

    return list.map((event) => {
      const member = team[event.actorId];
      const actorName = member ? fullName(member) : '—';
      const subject = this.subjectFor(event, deals, contacts, companies, activities);
      const slots: Record<string, RichSlot> = {
        actor: { text: actorName },
        subject,
      };
      if (event.toStage) slots['stage'] = { text: t(`enums.stage.${event.toStage}`) };
      return {
        id: event.id,
        at: event.at,
        icon: KIND_ICON[event.kind].icon,
        tone: KIND_ICON[event.kind].tone,
        key: `events.${event.kind}`,
        slots,
        actorName,
      };
    });
  });

  private subjectFor(
    event: TimelineEvent,
    deals: Record<string, Deal>,
    contacts: Record<string, Contact>,
    companies: Record<string, Company>,
    activities: Record<string, Activity>,
  ): RichSlot {
    switch (event.kind) {
      case 'deal-created':
      case 'deal-stage-changed':
      case 'deal-won':
      case 'deal-lost': {
        const deal = event.dealId ? deals[event.dealId] : undefined;
        return { text: deal?.name ?? event.label, link: deal ? `/deals/${deal.id}` : null };
      }
      case 'contact-created': {
        const contact = event.contactId ? contacts[event.contactId] : undefined;
        return { text: contact ? fullName(contact) : event.label, link: contact ? `/contacts/${contact.id}` : null };
      }
      case 'company-created': {
        const company = event.companyId ? companies[event.companyId] : undefined;
        return { text: company?.name ?? event.label, link: company ? `/companies/${company.id}` : null };
      }
      case 'activity-completed': {
        const activity = event.activityId ? activities[event.activityId] : undefined;
        return { text: activity?.subject ?? event.label, link: null };
      }
    }
  }
}
