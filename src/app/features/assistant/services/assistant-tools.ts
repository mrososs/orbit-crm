import { inject, Injectable } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom } from 'rxjs';
import { resolveRange } from '../../../core/analytics/date-range';
import { computeKpis, historyStart, pipelineByStage, StageSummary } from '../../../core/analytics/metrics';
import { isActivityOverdue } from '../../../core/domain/activity-rules';
import { isDealOverdue } from '../../../core/domain/deal-rules';
import { Deal, DEAL_STAGES, DealStage, fullName, isOpenStage, OPEN_STAGES, PRIORITIES } from '../../../core/models';
import { CLOCK } from '../../../core/services/platform';
import { PreferencesService, RangePreset } from '../../../core/services/preferences.service';
import { CURRENT_USER_ID } from '../../../core/services/session';
import { addDays, toIsoDate } from '../../../shared/utils/date';
import { createId } from '../../../shared/utils/id';
import { CrmService, StageMoveReceipt } from '../../../state/crm.service';
import { ActivitiesStore, CompaniesStore, ContactsStore, DealsStore, TeamStore } from '../../../state/entity-stores';
import { WorkspaceService } from '../../../state/workspace.service';
import { RecordItem } from '../schemas/a2ui.schemas';
import { FollowUpInput, RecordLookup } from '../schemas/domain.schemas';

export interface OptionDto {
  value: string;
  label?: string;
  labelKey?: string;
  description?: string;
}

export interface SalesOverview {
  preset: Exclude<RangePreset, 'custom'>;
  rangeStart: string;
  rangeEnd: string;
  comparable: boolean;
  revenue: number;
  revenueChange: number | null;
  dealsWon: number;
  pipeline: number;
  weighted: number;
  openDeals: number;
  winRate: number | null;
  followUps: number;
  overdue: number;
  stages: StageSummary[];
}

export interface DealList {
  scope: 'mine' | 'team';
  ownerName: string;
  total: number;
  totalValue: number;
  items: RecordItem[];
}

export interface FilteredDeals {
  ownerId: string;
  stage: DealStage | 'all';
  total: number;
  totalValue: number;
  items: RecordItem[];
}

export interface FollowUpOptions {
  contacts: OptionDto[];
  deals: OptionDto[];
  owners: OptionDto[];
  priorities: OptionDto[];
  defaults: { subject: string; dueDate: string; dueTime: string; priority: string; ownerId: string; contactId: string; dealId: string };
}

export interface CreatedFollowUp {
  id: string;
  subject: string;
  dueAt: string;
  contact: { id: string; label: string } | null;
  deal: { id: string; label: string } | null;
}

export interface MoveDetails {
  dealId: string;
  dealName: string;
  value: number;
  fromStage: DealStage;
  toStage: DealStage;
}

/**
 * The agent's tools: the only way the demo agent reads or changes CRM data.
 * Read models return plain JSON (what a remote agent would receive over HTTP);
 * writes go through the existing `CrmService` domain commands.
 */
export abstract class AssistantTools implements RecordLookup {
  abstract ready(): Promise<void>;
  abstract salesOverview(): SalesOverview;
  abstract topOpenDeals(scope: 'mine' | 'team', limit: number): DealList;
  abstract overdueActivities(): RecordItem[];
  abstract filterDeals(ownerId: string, stage: DealStage | 'all'): FilteredDeals;
  abstract ownerOptions(withAll: boolean): OptionDto[];
  abstract stageOptions(withAll: boolean, openOnly?: boolean): OptionDto[];
  abstract openDealOptions(): OptionDto[];
  abstract followUpOptions(prefill: { contactId?: string; dealId?: string }): FollowUpOptions;
  abstract createFollowUp(input: FollowUpInput): Promise<CreatedFollowUp>;
  abstract dealRecord(dealId: string): RecordItem | null;
  abstract moveDetails(dealId: string, toStage: DealStage): MoveDetails | null;
  abstract moveDeal(dealId: string, toStage: DealStage): Promise<{ receiptId: string; details: MoveDetails } | null>;
  abstract undoMove(receiptId: string): Promise<MoveDetails | null>;
  abstract currentUserName(): string;
  abstract today(): string;
  abstract hasMember(id: string): boolean;
  abstract hasContact(id: string): boolean;
  abstract hasOpenDeal(id: string): boolean;
  abstract dealStage(id: string): string | null;
  abstract teamMembers(): { id: string; firstName: string; lastName: string }[];
}

@Injectable()
export class CrmAssistantTools extends AssistantTools {
  private readonly clock = inject(CLOCK);
  private readonly prefs = inject(PreferencesService);
  private readonly workspace = inject(WorkspaceService);
  private readonly crm = inject(CrmService);
  private readonly deals = inject(DealsStore);
  private readonly contacts = inject(ContactsStore);
  private readonly companies = inject(CompaniesStore);
  private readonly activities = inject(ActivitiesStore);
  private readonly team = inject(TeamStore);
  private readonly ready$ = toObservable(this.workspace.isReady);
  /** Undo receipts for stage moves made through the assistant, by receipt id. */
  private readonly receipts = new Map<string, { receipt: StageMoveReceipt; details: MoveDetails }>();

  ready(): Promise<void> {
    return this.workspace.isReady() ? Promise.resolve() : firstValueFrom(this.ready$.pipe(filter(Boolean))).then(() => undefined);
  }

  /** Same figures as the dashboard's default view: its default period, whole team. */
  salesOverview(): SalesOverview {
    const now = this.clock();
    const preset = this.prefs.dashboardRange();
    const deals = this.deals.entities();
    const range = resolveRange(preset, now);
    const kpis = computeKpis(deals, this.activities.entities(), range, now, historyStart(deals));
    return {
      preset,
      rangeStart: toIsoDate(range.start),
      rangeEnd: toIsoDate(range.end),
      comparable: kpis.revenue.change !== null,
      revenue: kpis.revenue.value,
      revenueChange: kpis.revenue.change,
      dealsWon: kpis.revenue.dealsWon,
      pipeline: kpis.pipeline.value,
      weighted: kpis.pipeline.weighted,
      openDeals: kpis.pipeline.openDeals,
      winRate: kpis.winRate.value,
      followUps: kpis.followUps.value,
      overdue: kpis.followUps.overdue,
      stages: pipelineByStage(deals),
    };
  }

  topOpenDeals(scope: 'mine' | 'team', limit: number): DealList {
    const open = this.deals.openDeals().filter((d) => scope === 'team' || d.ownerId === CURRENT_USER_ID);
    const sorted = [...open].sort((a, b) => b.value - a.value);
    return {
      scope,
      ownerName: this.currentUserName(),
      total: open.length,
      totalValue: open.reduce((sum, d) => sum + d.value, 0),
      items: sorted.slice(0, limit).map((d) => this.dealItem(d)),
    };
  }

  overdueActivities(): RecordItem[] {
    const now = this.clock();
    const deals = this.deals.entityMap();
    const contacts = this.contacts.entityMap();
    return this.activities
      .open()
      .filter((a) => isActivityOverdue(a, now))
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
      .slice(0, 12)
      .map((a) => {
        const contact = a.contactId ? contacts[a.contactId] : undefined;
        const deal = a.dealId ? deals[a.dealId] : undefined;
        const related: RecordItem['related'] = [];
        if (contact) related.push({ kind: 'contact', id: contact.id, label: fullName(contact) });
        if (deal) related.push({ kind: 'deal', id: deal.id, label: deal.name });
        return {
          id: a.id,
          title: a.subject,
          subtitle: [contact && fullName(contact), deal?.name].filter(Boolean).join(' · ') || undefined,
          date: a.dueAt,
          dateKind: 'due' as const,
          overdue: true,
          priority: a.priority,
          owner: this.memberName(a.ownerId),
          link: related[0],
          related,
        };
      });
  }

  filterDeals(ownerId: string, stage: DealStage | 'all'): FilteredDeals {
    const matches = this.deals
      .entities()
      .filter((d) => (ownerId === 'all' || d.ownerId === ownerId) && (stage === 'all' ? isOpenStage(d.stage) : d.stage === stage))
      .sort((a, b) => b.value - a.value);
    return {
      ownerId,
      stage,
      total: matches.length,
      totalValue: matches.reduce((sum, d) => sum + d.value, 0),
      items: matches.slice(0, 15).map((d) => this.dealItem(d)),
    };
  }

  ownerOptions(withAll: boolean): OptionDto[] {
    const members = this.team.members().map((m) => ({ value: m.id, label: fullName(m) }));
    return withAll ? [{ value: 'all', labelKey: 'assistant.filters.allOwners' }, ...members] : members;
  }

  stageOptions(withAll: boolean, openOnly = false): OptionDto[] {
    const stages = (openOnly ? OPEN_STAGES : DEAL_STAGES).map((s) => ({ value: s, labelKey: `enums.stage.${s}` }));
    return withAll ? [{ value: 'all', labelKey: 'assistant.filters.openStages' }, ...stages] : stages;
  }

  openDealOptions(): OptionDto[] {
    const companies = this.companies.entityMap();
    return [...this.deals.openDeals()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((d) => ({ value: d.id, label: d.name, description: (d.companyId && companies[d.companyId]?.name) || undefined }));
  }

  followUpOptions(prefill: { contactId?: string; dealId?: string }): FollowUpOptions {
    const companies = this.companies.entityMap();
    const contacts = this.contacts.sorted().map((c) => ({
      value: c.id,
      label: fullName(c),
      description: (c.companyId && companies[c.companyId]?.name) || c.email,
    }));
    const deal = prefill.dealId ? this.deals.entityMap()[prefill.dealId] : undefined;
    return {
      contacts,
      deals: this.openDealOptions(),
      owners: this.ownerOptions(false),
      priorities: PRIORITIES.map((p) => ({ value: p, labelKey: `enums.priority.${p}` })),
      defaults: {
        subject: '',
        dueDate: toIsoDate(addDays(this.clock(), 1)),
        dueTime: '10:00',
        priority: 'medium',
        ownerId: CURRENT_USER_ID,
        contactId: prefill.contactId ?? deal?.contactId ?? '',
        dealId: deal && isOpenStage(deal.stage) ? deal.id : '',
      },
    };
  }

  async createFollowUp(input: FollowUpInput): Promise<CreatedFollowUp> {
    const activity = await this.crm.createActivity({
      type: 'follow-up',
      subject: input.subject,
      description: '',
      dueAt: new Date(`${input.dueDate}T${input.dueTime}:00`).toISOString(),
      priority: input.priority,
      ownerId: input.ownerId,
      contactId: input.contactId || null,
      dealId: input.dealId || null,
    });
    const contact = activity.contactId ? this.contacts.entityMap()[activity.contactId] : undefined;
    const deal = activity.dealId ? this.deals.entityMap()[activity.dealId] : undefined;
    return {
      id: activity.id,
      subject: activity.subject,
      dueAt: activity.dueAt,
      contact: contact ? { id: contact.id, label: fullName(contact) } : null,
      deal: deal ? { id: deal.id, label: deal.name } : null,
    };
  }

  dealRecord(dealId: string): RecordItem | null {
    const deal = this.deals.entityMap()[dealId];
    return deal ? this.dealItem(deal) : null;
  }

  moveDetails(dealId: string, toStage: DealStage): MoveDetails | null {
    const deal = this.deals.entityMap()[dealId];
    return deal ? { dealId, dealName: deal.name, value: deal.value, fromStage: deal.stage, toStage } : null;
  }

  async moveDeal(dealId: string, toStage: DealStage): Promise<{ receiptId: string; details: MoveDetails } | null> {
    const details = this.moveDetails(dealId, toStage);
    const receipt = await this.crm.moveDeal(dealId, toStage);
    if (!details || !receipt) return null;
    const receiptId = createId('rc');
    this.receipts.set(receiptId, { receipt, details });
    return { receiptId, details };
  }

  async undoMove(receiptId: string): Promise<MoveDetails | null> {
    const entry = this.receipts.get(receiptId);
    if (!entry) return null;
    this.receipts.delete(receiptId);
    await this.crm.undoMove(entry.receipt);
    return entry.details;
  }

  currentUserName(): string {
    return this.memberName(CURRENT_USER_ID);
  }

  today(): string {
    return toIsoDate(this.clock());
  }

  hasMember(id: string): boolean {
    return !!this.team.entityMap()[id];
  }

  hasContact(id: string): boolean {
    return !!this.contacts.entityMap()[id];
  }

  hasOpenDeal(id: string): boolean {
    const deal = this.deals.entityMap()[id];
    return !!deal && isOpenStage(deal.stage);
  }

  dealStage(id: string): string | null {
    return this.deals.entityMap()[id]?.stage ?? null;
  }

  teamMembers(): { id: string; firstName: string; lastName: string }[] {
    return this.team.entities().map((m) => ({ id: m.id, firstName: m.firstName, lastName: m.lastName }));
  }

  private memberName(id: string): string {
    const member = this.team.entityMap()[id];
    return member ? fullName(member) : '';
  }

  private dealItem(deal: Deal): RecordItem {
    const company = deal.companyId ? this.companies.entityMap()[deal.companyId] : undefined;
    return {
      id: deal.id,
      title: deal.name,
      subtitle: company?.name,
      amount: deal.value,
      date: deal.expectedCloseDate,
      dateKind: 'close',
      overdue: isDealOverdue(deal, this.clock()),
      stage: deal.stage,
      owner: this.memberName(deal.ownerId),
      link: { kind: 'deal', id: deal.id, label: deal.name },
      related: company ? [{ kind: 'company', id: company.id, label: company.name }] : [],
    };
  }
}
