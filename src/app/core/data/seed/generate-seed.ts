import {
  Activity,
  ACTIVITY_TYPES,
  Company,
  CompanySize,
  Contact,
  ContactStatus,
  CrmDatabase,
  Deal,
  DealStage,
  LEAD_SOURCES,
  OPEN_STAGES,
  OpenStage,
  Priority,
  TeamMember,
  TimelineEvent,
} from '../../models';
import { addDays, startOfDay, toIsoDate } from '../../../shared/utils/date';
import {
  ACTIVITY_DESCRIPTIONS,
  ACTIVITY_TEMPLATES,
  CLOSERS,
  CONTACT_NOTES,
  COMPANY_SEED,
  CompanySeed,
  DEAL_NOTES,
  DEAL_TAGS,
  DEAL_TEMPLATES,
  FIRST_NAMES,
  JOB_TITLES,
  LAST_NAMES,
  SDRS,
  TEAM_SEED,
} from './catalog';
import { SeededRandom } from './random';

/** Fixed seed — changing it produces a different (but still deterministic) workspace. */
export const SEED_VALUE = 20260603;
export const SCHEMA_VERSION = 1;

const DEAL_VALUE_RANGE: Record<CompanySize, [number, number]> = {
  '1-10': [4000, 12000],
  '11-50': [6000, 24000],
  '51-200': [12000, 48000],
  '201-500': [20000, 75000],
  '501-1000': [32000, 110000],
  '1000+': [48000, 165000],
};

/** Won deals per 30-day window, most recent window first (growth trend). */
const WON_PER_WINDOW = [4, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1];
const LOST_COUNT = 20;
const OPEN_STAGE_COUNTS: Record<OpenStage, number> = { new: 7, qualified: 8, proposal: 8, negotiation: 9 };

/**
 * Generates the complete demo workspace. Output is fully determined by `anchor`
 * (the day the workspace is seeded) — relative dates keep the demo current.
 */
export function generateSeed(anchor: Date): CrmDatabase {
  const rng = new SeededRandom(SEED_VALUE);
  const today = startOfDay(anchor);

  const at = (daysAgo: number, hour = 10, minute = 0): Date => {
    const d = addDays(today, -daysAgo);
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  const businessTime = (daysAgo: number): Date =>
    at(daysAgo, rng.int(9, 17), rng.pick([0, 15, 30, 45]));
  const iso = (d: Date) => d.toISOString();
  const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);

  // ── Team ───────────────────────────────────────────────────────────────
  const team: TeamMember[] = TEAM_SEED.map((t) => ({
    id: t.id,
    firstName: t.firstName,
    lastName: t.lastName,
    email: `${slug(t.firstName)}.${slug(t.lastName)}@orbitsales.co`,
    role: t.role,
    quarterlyQuota: t.quarterlyQuota,
    joinedAt: toIsoDate(addDays(today, -t.joinedDaysAgo)),
  }));

  // ── Companies ──────────────────────────────────────────────────────────
  const ownerOrder = rng.shuffle(CLOSERS);
  const companies: Company[] = COMPANY_SEED.map((c, i) => {
    const created = businessTime(rng.int(470, 540));
    return {
      id: `co_${pad(i + 1)}`,
      name: c.name,
      website: `https://${c.domain}`,
      industry: c.industry,
      size: c.size,
      city: c.city,
      countryCode: c.countryCode,
      ownerId: ownerOrder[i % ownerOrder.length],
      description: c.description,
      createdAt: iso(created),
      updatedAt: iso(created),
    };
  });
  const seedByCompany = new Map<string, CompanySeed>(companies.map((c, i) => [c.id, COMPANY_SEED[i]]));

  // ── Contacts ───────────────────────────────────────────────────────────
  const contactsPerCompany = companies.map(() => 3);
  const largeCompanyIdx = companies
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => ['201-500', '501-1000', '1000+'].includes(c.size))
    .map(({ i }) => i);
  for (const idx of rng.sample(largeCompanyIdx, 10)) contactsPerCompany[idx]++;

  const usedNames = new Set<string>(team.map((t) => `${t.firstName} ${t.lastName}`));
  const contacts: Contact[] = [];
  companies.forEach((company, ci) => {
    const seed = seedByCompany.get(company.id)!;
    const companyAge = daysBetween(new Date(company.createdAt), today);
    const titles = rng.sample(JOB_TITLES, contactsPerCompany[ci]);
    for (let k = 0; k < contactsPerCompany[ci]; k++) {
      let first: string;
      let last: string;
      do {
        first = rng.pick(FIRST_NAMES);
        last = rng.pick(LAST_NAMES);
      } while (usedNames.has(`${first} ${last}`));
      usedNames.add(`${first} ${last}`);

      // Skewed toward recent months: CRMs keep adding leads.
      const createdDaysAgo = Math.round(Math.pow(rng.next(), 1.8) * companyAge);
      const created = businessTime(Math.max(4, Math.min(companyAge - 3, createdDaysAgo)));
      contacts.push({
        id: `ct_${pad(contacts.length + 1)}`,
        firstName: first,
        lastName: last,
        email: `${slug(first)}.${slug(last)}@${seed.domain}`,
        phone: phoneFor(seed, rng),
        jobTitle: titles[k],
        companyId: company.id,
        status: 'lead',
        source: rng.weighted(LEAD_SOURCES, [28, 18, 20, 12, 14, 8]),
        ownerId: rng.chance(0.85) ? company.ownerId : rng.pick([...CLOSERS, ...SDRS]),
        notes: '',
        createdAt: iso(created),
        updatedAt: iso(created),
        lastInteractionAt: null,
      });
    }
  });
  const contactsByCompany = groupBy(contacts, (c) => c.companyId ?? '');

  // ── Deals ──────────────────────────────────────────────────────────────
  const stages: DealStage[] = [
    ...WON_PER_WINDOW.flatMap((count) => Array<DealStage>(count).fill('won')),
    ...Array<DealStage>(LOST_COUNT).fill('lost'),
    ...OPEN_STAGES.flatMap((s) => Array<DealStage>(OPEN_STAGE_COUNTS[s]).fill(s)),
  ];
  const wonWindows = WON_PER_WINDOW.flatMap((count, window) => Array<number>(count).fill(window));

  const companyIds = [
    ...companies.map((c) => c.id),
    ...Array.from({ length: stages.length - companies.length }, () =>
      rng.weighted(
        companies.map((c) => c.id),
        companies.map((c) => sizeWeight(c.size)),
      ),
    ),
  ];
  const dealCompanies = rng.shuffle(companyIds);
  // Closed-won revenue is spread across closers, as a manager would balance territories.
  const wonOwnerOrder = rng.shuffle(CLOSERS);
  const usedDealNames = new Set<string>();
  const deals: Deal[] = [];
  let wonCursor = 0;

  stages.forEach((stage, i) => {
    const company = companies.find((c) => c.id === dealCompanies[i])!;
    const seed = seedByCompany.get(company.id)!;
    const contact = rng.pick(contactsByCompany.get(company.id)!);
    const [min, max] = DEAL_VALUE_RANGE[company.size];
    const value = Math.round(rng.int(min, max) / 500) * 500;

    let template: string;
    do {
      template = rng.pick(DEAL_TEMPLATES);
    } while (usedDealNames.has(`${seed.short} ${template}`));
    usedDealNames.add(`${seed.short} ${template}`);

    let ownerId = rng.chance(0.8) ? company.ownerId : rng.pick(CLOSERS);
    if (stage === 'new' && rng.chance(0.4)) ownerId = rng.pick(SDRS);

    let created: Date;
    let closed: Date | null = null;
    let expectedClose: Date;
    let updated: Date;
    let lostAtStage: OpenStage | null = null;

    if (stage === 'won') {
      ownerId = wonOwnerOrder[wonCursor % wonOwnerOrder.length];
      const window = wonWindows[wonCursor++];
      const closedDaysAgo = window * 30 + rng.int(1, 29);
      closed = businessTime(closedDaysAgo);
      created = businessTime(closedDaysAgo + rng.int(21, 95));
      expectedClose = addDays(closed, rng.int(-10, 12));
      updated = closed;
    } else if (stage === 'lost') {
      const closedDaysAgo = rng.int(3, 355);
      closed = businessTime(closedDaysAgo);
      created = businessTime(closedDaysAgo + rng.int(14, 80));
      expectedClose = addDays(closed, rng.int(-5, 25));
      updated = closed;
      lostAtStage = rng.weighted(OPEN_STAGES, [10, 30, 35, 25]);
    } else {
      const ageRange: Record<OpenStage, [number, number]> = {
        new: [2, 25],
        qualified: [10, 45],
        proposal: [20, 70],
        negotiation: [30, 100],
      };
      const [a, b] = ageRange[stage as OpenStage];
      const createdDaysAgo = rng.int(a, b);
      created = businessTime(createdDaysAgo);
      updated = businessTime(rng.int(1, Math.max(1, createdDaysAgo - 1)));
      const overdue = rng.chance(0.15);
      expectedClose = overdue
        ? addDays(today, -rng.int(1, 12))
        : addDays(today, stage === 'negotiation' ? rng.int(3, 30) : rng.int(10, 80));
    }

    // Keep the relationship timeline coherent: contact exists before the deal.
    if (new Date(contact.createdAt) > created) {
      const adjusted = addDays(created, -rng.int(2, 10));
      contact.createdAt = iso(adjusted);
      contact.updatedAt = iso(adjusted);
    }

    const tags = rng.sample(DEAL_TAGS, rng.weighted([0, 1, 2], [3, 5, 2]));
    if (template === 'Contract Renewal' && !tags.includes('renewal')) tags.unshift('renewal');

    deals.push({
      id: `dl_${pad(i + 1)}`,
      name: `${seed.short} ${template}`,
      companyId: company.id,
      contactId: contact.id,
      value,
      stage,
      priority: priorityFor(value, rng),
      ownerId,
      source: contact.source,
      expectedCloseDate: toIsoDate(expectedClose),
      tags,
      notes: rng.chance(0.7) ? rng.pick(DEAL_NOTES) : '',
      createdAt: iso(created),
      updatedAt: iso(updated),
      closedAt: closed ? iso(closed) : null,
      lostAtStage,
    });
  });

  // ── Activities ─────────────────────────────────────────────────────────
  const activities: Activity[] = [];
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const companyById = new Map(companies.map((c) => [c.id, c]));

  const makeSubject = (type: Activity['type'], contact: Contact) => {
    const company = contact.companyId ? companyById.get(contact.companyId) : undefined;
    const short = company ? seedByCompany.get(company.id)!.short : contact.lastName;
    return rng
      .pick(ACTIVITY_TEMPLATES[type])
      .replace('{name}', contact.firstName)
      .replace('{company}', short);
  };

  const pushActivity = (
    contact: Contact,
    dealId: string | null,
    ownerId: string,
    due: Date,
    completed: Date | null,
  ) => {
    const type = rng.weighted(ACTIVITY_TYPES, [30, 25, 25, 20]);
    const created = addDays(due, -rng.int(1, 9));
    activities.push({
      id: `ac_${pad(activities.length + 1)}`,
      type,
      subject: makeSubject(type, contact),
      description: rng.chance(0.75) ? rng.pick(ACTIVITY_DESCRIPTIONS) : '',
      dueAt: iso(due),
      completedAt: completed ? iso(completed) : null,
      priority: rng.weighted<Priority>(['low', 'medium', 'high'], [3, 5, 2]),
      ownerId,
      contactId: contact.id,
      dealId,
      createdAt: iso(created),
      updatedAt: iso(completed ?? created),
    });
  };

  // One completed touchpoint inside every deal's active lifetime.
  for (const deal of deals) {
    const contact = contactById.get(deal.contactId!)!;
    const start = new Date(deal.createdAt);
    const end = deal.closedAt ? new Date(deal.closedAt) : today;
    const span = Math.max(1, daysBetween(start, end));
    const due = businessTime(Math.max(1, daysBetween(addDays(start, rng.int(1, span)), today)));
    // Most touchpoints are logged on time; about one in five is completed 1–3 days late.
    const roll = rng.int(0, 99);
    const delayMinutes = roll < 80 ? roll : (roll - 79) * 210;
    const completed = new Date(Math.min(due.getTime() + delayMinutes * 60_000, today.getTime() - 3_600_000));
    pushActivity(contact, deal.id, deal.ownerId, due, completed);
  }

  // Open follow-ups: overdue, today and upcoming.
  const openOffsets = rng.shuffle([
    ...Array.from({ length: 8 }, () => -rng.int(1, 10)),
    ...Array<number>(5).fill(0),
    ...Array.from({ length: 15 }, () => rng.int(1, 7)),
    ...Array.from({ length: 12 }, () => rng.int(8, 21)),
  ]);
  const openDeals = deals.filter((d) => d.closedAt === null);
  const leadContacts = rng.sample(
    contacts.filter((c) => !deals.some((d) => d.contactId === c.id)),
    openOffsets.length - openDeals.length,
  );
  openOffsets.forEach((offset, i) => {
    const deal = openDeals[i];
    const contact = deal ? contactById.get(deal.contactId!)! : leadContacts[i - openDeals.length];
    const ownerId = deal ? deal.ownerId : contact.ownerId;
    const due =
      offset === 0
        ? at(0, rng.int(13, 17), rng.pick([0, 30]))
        : at(-offset, rng.int(9, 17), rng.pick([0, 15, 30, 45]));
    pushActivity(contact, deal?.id ?? null, ownerId, due, null);
  });

  activities.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  activities.forEach((a, i) => (a.id = `ac_${pad(i + 1)}`));

  // ── Derived contact fields ─────────────────────────────────────────────
  contacts.forEach((contact, i) => {
    // Deterministic (RNG-free) notes so adding them leaves the rest of the dataset unchanged.
    if (i % 3 === 0) contact.notes = CONTACT_NOTES[(i / 3) % CONTACT_NOTES.length];
  });
  for (const contact of contacts) {
    const touches = activities
      .filter((a) => a.contactId === contact.id && a.completedAt)
      .map((a) => a.completedAt!)
      .sort();
    contact.lastInteractionAt = touches.at(-1) ?? null;
    contact.status = statusFor(contact, deals, today, rng);
  }

  // ── Timeline events ────────────────────────────────────────────────────
  const events: TimelineEvent[] = [];
  const pushEvent = (e: Omit<TimelineEvent, 'id'>) =>
    events.push({ id: `ev_${pad(events.length + 1, 4)}`, ...e });
  const blank = { dealId: null, contactId: null, companyId: null, activityId: null };

  for (const c of companies) {
    pushEvent({ ...blank, kind: 'company-created', at: c.createdAt, actorId: c.ownerId, companyId: c.id, label: c.name });
  }
  for (const c of contacts) {
    pushEvent({
      ...blank,
      kind: 'contact-created',
      at: c.createdAt,
      actorId: c.ownerId,
      contactId: c.id,
      companyId: c.companyId,
      label: `${c.firstName} ${c.lastName}`,
    });
  }
  for (const d of deals) {
    const base = { ...blank, dealId: d.id, companyId: d.companyId, contactId: d.contactId, label: d.name };
    pushEvent({ ...base, kind: 'deal-created', at: d.createdAt, actorId: d.ownerId, value: d.value });
    if (d.stage === 'won' || d.stage === 'lost') {
      pushEvent({ ...base, kind: d.stage === 'won' ? 'deal-won' : 'deal-lost', at: d.closedAt!, actorId: d.ownerId, value: d.value, toStage: d.stage });
    } else if (d.stage !== 'new') {
      const idx = OPEN_STAGES.indexOf(d.stage);
      pushEvent({ ...base, kind: 'deal-stage-changed', at: d.updatedAt, actorId: d.ownerId, fromStage: OPEN_STAGES[idx - 1], toStage: d.stage });
    }
  }
  for (const a of activities.filter((x) => x.completedAt)) {
    const contact = a.contactId ? contactById.get(a.contactId) : undefined;
    pushEvent({
      ...blank,
      kind: 'activity-completed',
      at: a.completedAt!,
      actorId: a.ownerId,
      activityId: a.id,
      dealId: a.dealId,
      contactId: a.contactId,
      companyId: contact?.companyId ?? null,
      label: a.subject,
    });
  }
  events.sort((a, b) => a.at.localeCompare(b.at));
  events.forEach((e, i) => (e.id = `ev_${pad(i + 1, 4)}`));

  return {
    schemaVersion: SCHEMA_VERSION,
    seededAt: today.toISOString(),
    team,
    companies,
    contacts,
    deals,
    activities,
    events,
  };
}

// ── helpers ──────────────────────────────────────────────────────────────

function pad(n: number, width = 3): string {
  return String(n).padStart(width, '0');
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase();
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    map.set(k, [...(map.get(k) ?? []), item]);
  }
  return map;
}

function sizeWeight(size: CompanySize): number {
  return { '1-10': 1, '11-50': 1, '51-200': 2, '201-500': 3, '501-1000': 3, '1000+': 4 }[size];
}

function priorityFor(value: number, rng: SeededRandom): Priority {
  if (value >= 70000) return rng.weighted<Priority>(['high', 'medium', 'low'], [6, 3, 1]);
  if (value >= 25000) return rng.weighted<Priority>(['high', 'medium', 'low'], [3, 5, 2]);
  return rng.weighted<Priority>(['high', 'medium', 'low'], [1, 4, 5]);
}

function statusFor(contact: Contact, deals: Deal[], today: Date, rng: SeededRandom): ContactStatus {
  const own = deals.filter((d) => d.contactId === contact.id);
  const company = deals.filter((d) => d.companyId === contact.companyId);
  const companyWon = company.filter((d) => d.stage === 'won');
  const companyOpen = company.filter((d) => d.closedAt === null);

  if (own.some((d) => d.stage === 'won')) return 'customer';
  if (companyWon.length > 0) {
    const latestWin = Math.max(...companyWon.map((d) => new Date(d.closedAt!).getTime()));
    const stale = today.getTime() - latestWin > 240 * 86_400_000 && companyOpen.length === 0;
    if (stale && rng.chance(0.45)) return 'churned';
    return rng.chance(0.55) ? 'customer' : 'prospect';
  }
  if (own.some((d) => d.closedAt === null)) return 'prospect';
  if (companyOpen.length > 0) return rng.chance(0.6) ? 'prospect' : 'lead';
  return 'lead';
}

const PHONE_PREFIX: Record<string, string> = {
  Seattle: '+1 (206) 555-01',
  Boston: '+1 (617) 555-01',
  Austin: '+1 (512) 555-01',
  'New York': '+1 (212) 555-01',
  Chicago: '+1 (312) 555-01',
  'San Francisco': '+1 (415) 555-01',
  'Los Angeles': '+1 (310) 555-01',
  Denver: '+1 (303) 555-01',
  Houston: '+1 (713) 555-01',
  Toronto: '+1 (416) 555-01',
  Montréal: '+1 (514) 555-01',
};

/** Phone numbers use reserved fictional ranges where the numbering plan defines one. */
function phoneFor(seed: CompanySeed, rng: SeededRandom): string {
  const d = (n: number) => Array.from({ length: n }, () => rng.int(0, 9)).join('');
  if (PHONE_PREFIX[seed.city]) return `${PHONE_PREFIX[seed.city]}${d(2)}`;
  switch (seed.countryCode) {
    case 'GB':
      return seed.city === 'Manchester' ? `+44 161 496 0${d(3)}` : `+44 20 7946 0${d(3)}`;
    case 'FR':
      return `+33 1 99 00 ${d(2)} ${d(2)}`;
    case 'AU':
      return `+61 2 5550 ${d(4)}`;
    case 'DE':
      return `+49 ${seed.city === 'Hamburg' ? '40' : '711'} 555 ${d(4)}`;
    case 'NL':
      return `+31 10 555 ${d(4)}`;
    case 'ES':
      return `+34 91 555 ${d(4)}`;
    case 'AE':
      return `+971 4 555 ${d(4)}`;
    case 'SA':
      return `+966 ${seed.city === 'Jeddah' ? '12' : '11'} 555 ${d(4)}`;
    case 'SG':
      return `+65 6555 ${d(4)}`;
    case 'DK':
      return `+45 55 55 ${d(2)} ${d(2)}`;
    case 'IE':
      return `+353 1 555 ${d(4)}`;
    case 'MA':
      return `+212 524 555 ${d(3)}`;
    default:
      return `+1 (555) 010-${d(4)}`;
  }
}
