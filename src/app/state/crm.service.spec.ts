import { TestBed } from '@angular/core/testing';
import { setupWorkspace, TEST_NOW } from '../../testing/test-providers';
import { previousRange, resolveRange } from '../core/analytics/date-range';
import { computeKpis, revenueIn } from '../core/analytics/metrics';
import { LocalDatabase } from '../core/data/local-database';
import { CrmService } from './crm.service';
import { ActivitiesStore, CompaniesStore, ContactsStore, DealsStore, TimelineStore } from './entity-stores';
import { WorkspaceService } from './workspace.service';

describe('CrmService', () => {
  let crm: CrmService;
  let deals: InstanceType<typeof DealsStore>;
  let contacts: InstanceType<typeof ContactsStore>;
  let companies: InstanceType<typeof CompaniesStore>;
  let activities: InstanceType<typeof ActivitiesStore>;
  let timeline: InstanceType<typeof TimelineStore>;

  beforeEach(async () => {
    await setupWorkspace();
    crm = TestBed.inject(CrmService);
    deals = TestBed.inject(DealsStore);
    contacts = TestBed.inject(ContactsStore);
    companies = TestBed.inject(CompaniesStore);
    activities = TestBed.inject(ActivitiesStore);
    timeline = TestBed.inject(TimelineStore);
  });

  it('hydrates every store from the repositories', () => {
    expect(deals.entities()).toHaveLength(80);
    expect(contacts.entities()).toHaveLength(100);
    expect(companies.entities()).toHaveLength(30);
    expect(activities.entities()).toHaveLength(120);
  });

  it('creates a deal, persists it and logs a timeline event', async () => {
    const created = await crm.createDeal({
      name: 'Test Expansion',
      companyId: 'co_001',
      contactId: null,
      value: 42_000,
      stage: 'qualified',
      priority: 'high',
      ownerId: 'tm_alex',
      source: 'referral',
      expectedCloseDate: '2026-07-30',
      tags: ['pilot'],
      notes: '',
    });

    expect(deals.entityMap()[created.id]).toMatchObject({ name: 'Test Expansion', stage: 'qualified', closedAt: null });
    expect(TestBed.inject(LocalDatabase).read('deals').some((d) => d.id === created.id)).toBe(true);
    const kinds = timeline.entities().filter((e) => e.dealId === created.id).map((e) => e.kind);
    expect(kinds).toEqual(expect.arrayContaining(['deal-created', 'deal-stage-changed']));
  });

  it('moving a deal to Won updates revenue and win rate derived metrics', async () => {
    const range = resolveRange('last30', TEST_NOW);
    const target = deals.entities().find((d) => d.stage === 'negotiation')!;
    const revenueBefore = revenueIn(deals.entities(), range);
    const wonBefore = computeKpis(deals.entities(), activities.entities(), range, TEST_NOW).winRate.won;
    const previousBefore = revenueIn(deals.entities(), previousRange(range));

    const receipt = await crm.moveDeal(target.id, 'won');

    expect(deals.entityMap()[target.id]).toMatchObject({ stage: 'won', closedAt: TEST_NOW.toISOString() });
    expect(revenueIn(deals.entities(), range)).toBe(revenueBefore + target.value);
    expect(computeKpis(deals.entities(), activities.entities(), range, TEST_NOW).winRate.won).toBe(wonBefore + 1);
    expect(timeline.entities().some((e) => e.id === receipt!.eventId && e.kind === 'deal-won')).toBe(true);
    // Previous period is unaffected.
    expect(revenueIn(deals.entities(), previousRange(range))).toBe(previousBefore);
  });

  it('undoes a stage move, restoring fields and removing the event', async () => {
    const target = deals.entities().find((d) => d.stage === 'proposal')!;
    const receipt = (await crm.moveDeal(target.id, 'lost'))!;
    expect(deals.entityMap()[target.id]!.lostAtStage).toBe('proposal');

    await crm.undoMove(receipt);
    expect(deals.entityMap()[target.id]).toMatchObject({ stage: 'proposal', closedAt: null, lostAtStage: null });
    expect(timeline.entityMap()[receipt.eventId!]).toBeUndefined();
  });

  it('creates, edits and deletes contacts with cascading unlinks', async () => {
    const contact = await crm.createContact({
      firstName: 'Lina',
      lastName: 'Saleh',
      email: 'lina@example.com',
      phone: '+966 11 555 0101',
      jobTitle: 'CFO',
      companyId: 'co_002',
      status: 'lead',
      source: 'event',
      ownerId: 'tm_omar',
      notes: '',
    });
    expect(contacts.entityMap()[contact.id]!.email).toBe('lina@example.com');

    await crm.updateContact(contact.id, { jobTitle: 'Chief Financial Officer', status: 'prospect' });
    expect(contacts.entityMap()[contact.id]).toMatchObject({ jobTitle: 'Chief Financial Officer', status: 'prospect' });

    const linkedDeal = deals.entities().find((d) => d.contactId !== null)!;
    await crm.deleteContact(linkedDeal.contactId!);
    expect(contacts.entityMap()[linkedDeal.contactId!]).toBeUndefined();
    expect(deals.entityMap()[linkedDeal.id]!.contactId).toBeNull();
  });

  it('deleting a company keeps its contacts and deals but unlinks them', async () => {
    const companyId = 'co_003';
    const linkedContacts = contacts.byCompany().get(companyId)!.map((c) => c.id);
    const linkedDeals = deals.byCompany().get(companyId)!.map((d) => d.id);

    await crm.deleteCompany(companyId);

    expect(companies.entityMap()[companyId]).toBeUndefined();
    for (const id of linkedContacts) expect(contacts.entityMap()[id]!.companyId).toBeNull();
    for (const id of linkedDeals) expect(deals.entityMap()[id]!.companyId).toBeNull();
  });

  it('completing a task logs it and refreshes the contact last interaction', async () => {
    const task = activities.open().find((a) => a.contactId !== null)!;
    await crm.setActivityCompleted(task.id, true);

    expect(activities.entityMap()[task.id]!.completedAt).toBe(TEST_NOW.toISOString());
    expect(contacts.entityMap()[task.contactId!]!.lastInteractionAt).toBe(TEST_NOW.toISOString());
    expect(timeline.entities().some((e) => e.kind === 'activity-completed' && e.activityId === task.id)).toBe(true);

    await crm.setActivityCompleted(task.id, false);
    expect(activities.entityMap()[task.id]!.completedAt).toBeNull();
    expect(timeline.entities().some((e) => e.kind === 'activity-completed' && e.activityId === task.id)).toBe(false);
  });

  it('reset restores the seeded dataset', async () => {
    await crm.deleteCompany('co_001');
    await crm.deleteDeal(deals.entities()[0].id);
    await TestBed.inject(WorkspaceService).reset();
    expect(companies.entities()).toHaveLength(30);
    expect(deals.entities()).toHaveLength(80);
  });
});
