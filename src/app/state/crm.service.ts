import { inject, Injectable } from '@angular/core';
import { completionChange } from '../core/domain/activity-rules';
import { stageChange, stageEventKind } from '../core/domain/deal-rules';
import {
  Activity,
  Company,
  Contact,
  Deal,
  DealStage,
  fullName,
  TimelineEvent,
} from '../core/models';
import { CLOCK } from '../core/services/platform';
import { CURRENT_USER_ID } from '../core/services/session';
import { createId } from '../shared/utils/id';
import {
  ActivitiesStore,
  CompaniesStore,
  ContactsStore,
  DealsStore,
  TimelineStore,
} from './entity-stores';

export type DealDraft = Pick<
  Deal,
  | 'name'
  | 'companyId'
  | 'contactId'
  | 'value'
  | 'stage'
  | 'priority'
  | 'ownerId'
  | 'source'
  | 'expectedCloseDate'
  | 'tags'
  | 'notes'
>;

export type ContactDraft = Pick<
  Contact,
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'jobTitle'
  | 'companyId'
  | 'status'
  | 'source'
  | 'ownerId'
  | 'notes'
>;

export type CompanyDraft = Pick<
  Company,
  'name' | 'website' | 'industry' | 'size' | 'city' | 'countryCode' | 'ownerId' | 'description'
>;

export type ActivityDraft = Pick<
  Activity,
  'type' | 'subject' | 'description' | 'dueAt' | 'priority' | 'ownerId' | 'contactId' | 'dealId'
>;

/** Snapshot needed to undo a stage move. */
export interface StageMoveReceipt {
  dealId: string;
  previous: Pick<Deal, 'stage' | 'closedAt' | 'lostAtStage' | 'updatedAt'>;
  eventId: string | null;
}

/**
 * Domain command layer. Every write that touches more than one collection —
 * timeline events, relationship cascades, derived fields — goes through here so
 * the rules exist in exactly one place.
 */
@Injectable({ providedIn: 'root' })
export class CrmService {
  private readonly clock = inject(CLOCK);
  private readonly companies = inject(CompaniesStore);
  private readonly contacts = inject(ContactsStore);
  private readonly deals = inject(DealsStore);
  private readonly activities = inject(ActivitiesStore);
  private readonly timeline = inject(TimelineStore);

  // ── Deals ────────────────────────────────────────────────────────────

  async createDeal(draft: DealDraft): Promise<Deal> {
    const now = this.clock();
    const timestamp = now.toISOString();
    const base: Deal = {
      ...draft,
      id: createId('dl'),
      stage: 'new',
      createdAt: timestamp,
      updatedAt: timestamp,
      closedAt: null,
      lostAtStage: null,
    };
    const deal: Deal = { ...base, ...stageChange(base, draft.stage, now) };
    await this.deals.add(deal);
    await this.logDealEvent(deal, 'deal-created');
    if (deal.stage !== 'new') await this.logDealEvent(deal, stageEventKind(deal.stage), 'new');
    return deal;
  }

  async updateDeal(id: string, changes: Partial<DealDraft>): Promise<Deal> {
    const current = this.deals.entityMap()[id];
    if (!current) throw new Error(`Deal ${id} not found`);
    const now = this.clock();
    const { stage, ...rest } = changes;
    const patch: Partial<Deal> = { ...rest, updatedAt: now.toISOString() };
    if (stage && stage !== current.stage) Object.assign(patch, stageChange(current, stage, now));
    const saved = await this.deals.patch(id, patch);
    if (stage && stage !== current.stage) await this.logDealEvent(saved, stageEventKind(stage), current.stage);
    return saved;
  }

  async moveDeal(id: string, toStage: DealStage): Promise<StageMoveReceipt | null> {
    const current = this.deals.entityMap()[id];
    if (!current || current.stage === toStage) return null;
    const previous = {
      stage: current.stage,
      closedAt: current.closedAt,
      lostAtStage: current.lostAtStage,
      updatedAt: current.updatedAt,
    };
    const saved = await this.deals.patch(id, stageChange(current, toStage, this.clock()));
    const event = await this.logDealEvent(saved, stageEventKind(toStage), current.stage);
    return { dealId: id, previous, eventId: event.id };
  }

  async undoMove(receipt: StageMoveReceipt): Promise<void> {
    await this.deals.patch(receipt.dealId, receipt.previous);
    if (receipt.eventId) await this.timeline.remove(receipt.eventId);
  }

  async deleteDeal(id: string): Promise<void> {
    const linked = this.activities.byDeal().get(id) ?? [];
    await Promise.all(linked.map((a) => this.activities.patch(a.id, { dealId: null })));
    await this.deals.remove(id);
  }

  // ── Contacts ─────────────────────────────────────────────────────────

  async createContact(draft: ContactDraft): Promise<Contact> {
    const timestamp = this.clock().toISOString();
    const contact: Contact = {
      ...draft,
      id: createId('ct'),
      createdAt: timestamp,
      updatedAt: timestamp,
      lastInteractionAt: null,
    };
    await this.contacts.add(contact);
    await this.logEvent({
      kind: 'contact-created',
      contactId: contact.id,
      companyId: contact.companyId,
      label: fullName(contact),
    });
    return contact;
  }

  updateContact(id: string, changes: Partial<ContactDraft>): Promise<Contact> {
    return this.contacts.patch(id, { ...changes, updatedAt: this.clock().toISOString() });
  }

  /** Deletes a contact; linked deals and activities are kept but unlinked. */
  async deleteContact(id: string): Promise<void> {
    const deals = this.deals.byContact().get(id) ?? [];
    const activities = this.activities.byContact().get(id) ?? [];
    await Promise.all([
      ...deals.map((d) => this.deals.patch(d.id, { contactId: null })),
      ...activities.map((a) => this.activities.patch(a.id, { contactId: null })),
    ]);
    await this.contacts.remove(id);
  }

  // ── Companies ────────────────────────────────────────────────────────

  async createCompany(draft: CompanyDraft): Promise<Company> {
    const timestamp = this.clock().toISOString();
    const company: Company = { ...draft, id: createId('co'), createdAt: timestamp, updatedAt: timestamp };
    await this.companies.add(company);
    await this.logEvent({ kind: 'company-created', companyId: company.id, label: company.name });
    return company;
  }

  updateCompany(id: string, changes: Partial<CompanyDraft>): Promise<Company> {
    return this.companies.patch(id, { ...changes, updatedAt: this.clock().toISOString() });
  }

  /** Deletes a company; its contacts and deals are kept but unlinked. */
  async deleteCompany(id: string): Promise<void> {
    const contacts = this.contacts.byCompany().get(id) ?? [];
    const deals = this.deals.byCompany().get(id) ?? [];
    await Promise.all([
      ...contacts.map((c) => this.contacts.patch(c.id, { companyId: null })),
      ...deals.map((d) => this.deals.patch(d.id, { companyId: null })),
    ]);
    await this.companies.remove(id);
  }

  // ── Activities ───────────────────────────────────────────────────────

  async createActivity(draft: ActivityDraft): Promise<Activity> {
    const timestamp = this.clock().toISOString();
    const activity: Activity = {
      ...draft,
      id: createId('ac'),
      completedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.activities.add(activity);
    return activity;
  }

  updateActivity(id: string, changes: Partial<ActivityDraft>): Promise<Activity> {
    return this.activities.patch(id, { ...changes, updatedAt: this.clock().toISOString() });
  }

  /** Completing a task logs it on the timeline and refreshes the contact's last interaction. */
  async setActivityCompleted(id: string, completed: boolean): Promise<Activity> {
    const current = this.activities.entityMap()[id];
    if (!current) throw new Error(`Activity ${id} not found`);
    const now = this.clock();
    const saved = await this.activities.patch(id, completionChange(current, completed, now));

    if (completed) {
      const contact = saved.contactId ? this.contacts.entityMap()[saved.contactId] : undefined;
      await this.logEvent({
        kind: 'activity-completed',
        activityId: saved.id,
        dealId: saved.dealId,
        contactId: saved.contactId,
        companyId: contact?.companyId ?? null,
        label: saved.subject,
      });
      if (contact) await this.contacts.patch(contact.id, { lastInteractionAt: now.toISOString() });
    } else {
      const event = this.timeline
        .entities()
        .find((e) => e.kind === 'activity-completed' && e.activityId === id);
      if (event) await this.timeline.remove(event.id);
    }
    return saved;
  }

  deleteActivity(id: string): Promise<void> {
    return this.activities.remove(id);
  }

  // ── Timeline ─────────────────────────────────────────────────────────

  private logDealEvent(
    deal: Deal,
    kind: TimelineEvent['kind'],
    fromStage?: DealStage,
  ): Promise<TimelineEvent> {
    return this.logEvent({
      kind,
      dealId: deal.id,
      companyId: deal.companyId,
      contactId: deal.contactId,
      label: deal.name,
      value: deal.value,
      ...(kind === 'deal-created' ? {} : { fromStage, toStage: deal.stage }),
    });
  }

  private async logEvent(
    event: Pick<TimelineEvent, 'kind' | 'label'> & Partial<TimelineEvent>,
  ): Promise<TimelineEvent> {
    const record: TimelineEvent = {
      id: createId('ev'),
      at: this.clock().toISOString(),
      actorId: CURRENT_USER_ID,
      dealId: null,
      contactId: null,
      companyId: null,
      activityId: null,
      ...event,
    };
    await this.timeline.add(record);
    return record;
  }
}
