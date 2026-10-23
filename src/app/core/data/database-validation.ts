import {
  Activity,
  ACTIVITY_TYPES,
  Company,
  COMPANY_SIZES,
  Contact,
  CONTACT_STATUSES,
  CrmDatabase,
  Deal,
  DEAL_STAGES,
  INDUSTRIES,
  isOneOf,
  LEAD_SOURCES,
  OPEN_STAGES,
  PRIORITIES,
  TEAM_ROLES,
  TeamMember,
  TIMELINE_EVENT_KINDS,
  TimelineEvent,
} from '../models';
import { isValidDate } from '../../shared/utils/date';
import { SCHEMA_VERSION } from './seed/generate-seed';

export interface SanitizeResult {
  db: CrmDatabase;
  /** Number of records dropped or relationships repaired. */
  repairs: number;
}

type Rec = Record<string, unknown>;

const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string';
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const nullableStr = (v: unknown): v is string | null => v === null || typeof v === 'string';
const nullableDate = (v: unknown) => v === null || isValidDate(v);

const VALIDATORS = {
  team: (r: Rec): boolean =>
    nonEmpty(r['id']) && nonEmpty(r['firstName']) && str(r['lastName']) && str(r['email']) &&
    isOneOf(TEAM_ROLES, r['role']) && num(r['quarterlyQuota']) && str(r['joinedAt']),
  companies: (r: Rec): boolean =>
    nonEmpty(r['id']) && nonEmpty(r['name']) && str(r['website']) && isOneOf(INDUSTRIES, r['industry']) &&
    isOneOf(COMPANY_SIZES, r['size']) && str(r['city']) && str(r['countryCode']) && str(r['ownerId']) &&
    str(r['description']) && isValidDate(r['createdAt']) && isValidDate(r['updatedAt']),
  contacts: (r: Rec): boolean =>
    nonEmpty(r['id']) && nonEmpty(r['firstName']) && str(r['lastName']) && str(r['email']) && str(r['phone']) &&
    str(r['jobTitle']) && nullableStr(r['companyId']) && isOneOf(CONTACT_STATUSES, r['status']) &&
    isOneOf(LEAD_SOURCES, r['source']) && str(r['ownerId']) && str(r['notes']) &&
    isValidDate(r['createdAt']) && isValidDate(r['updatedAt']) && nullableDate(r['lastInteractionAt']),
  deals: (r: Rec): boolean =>
    nonEmpty(r['id']) && nonEmpty(r['name']) && nullableStr(r['companyId']) && nullableStr(r['contactId']) &&
    num(r['value']) && (r['value'] as number) >= 0 && isOneOf(DEAL_STAGES, r['stage']) &&
    isOneOf(PRIORITIES, r['priority']) && str(r['ownerId']) && isOneOf(LEAD_SOURCES, r['source']) &&
    isValidDate(r['expectedCloseDate']) && Array.isArray(r['tags']) && str(r['notes']) &&
    isValidDate(r['createdAt']) && isValidDate(r['updatedAt']) && nullableDate(r['closedAt']) &&
    (r['lostAtStage'] === null || isOneOf(OPEN_STAGES, r['lostAtStage'])),
  activities: (r: Rec): boolean =>
    nonEmpty(r['id']) && isOneOf(ACTIVITY_TYPES, r['type']) && nonEmpty(r['subject']) && str(r['description']) &&
    isValidDate(r['dueAt']) && nullableDate(r['completedAt']) && isOneOf(PRIORITIES, r['priority']) &&
    str(r['ownerId']) && nullableStr(r['contactId']) && nullableStr(r['dealId']) &&
    isValidDate(r['createdAt']) && isValidDate(r['updatedAt']),
  events: (r: Rec): boolean =>
    nonEmpty(r['id']) && isOneOf(TIMELINE_EVENT_KINDS, r['kind']) && isValidDate(r['at']) && str(r['actorId']) &&
    str(r['label']),
} as const;

/**
 * Validates persisted data and repairs what it safely can: invalid records are
 * dropped, duplicate ids removed, and dangling relationships are unlinked.
 * Returns `null` when the payload is unusable (wrong shape or schema version).
 */
export function sanitizeDatabase(raw: unknown): SanitizeResult | null {
  if (!isRecord(raw) || raw['schemaVersion'] !== SCHEMA_VERSION || !isValidDate(raw['seededAt'])) {
    return null;
  }
  const keys = Object.keys(VALIDATORS) as (keyof typeof VALIDATORS)[];
  if (!keys.every((k) => Array.isArray(raw[k]))) return null;

  let repairs = 0;
  const clean = <T>(key: keyof typeof VALIDATORS): T[] => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const item of raw[key] as unknown[]) {
      if (isRecord(item) && VALIDATORS[key](item) && !seen.has(item['id'] as string)) {
        seen.add(item['id'] as string);
        out.push(item as T);
      } else {
        repairs++;
      }
    }
    return out;
  };

  const team = clean<TeamMember>('team');
  if (team.length === 0) return null;

  const companies = clean<Company>('companies');
  const contacts = clean<Contact>('contacts');
  const deals = clean<Deal>('deals');
  const activities = clean<Activity>('activities');
  const events = clean<TimelineEvent>('events');

  const teamIds = new Set(team.map((t) => t.id));
  const companyIds = new Set(companies.map((c) => c.id));
  const contactIds = new Set(contacts.map((c) => c.id));
  const dealIds = new Set(deals.map((d) => d.id));
  const fallbackOwner = team[0].id;

  const fixOwner = <T extends { ownerId: string }>(e: T) => {
    if (!teamIds.has(e.ownerId)) {
      e.ownerId = fallbackOwner;
      repairs++;
    }
  };
  const unlink = <T, K extends keyof T>(e: T, key: K, valid: Set<string>) => {
    const value = e[key] as unknown;
    if (value !== null && !valid.has(value as string)) {
      (e as Record<K, unknown>)[key] = null;
      repairs++;
    }
  };

  companies.forEach(fixOwner);
  for (const c of contacts) {
    fixOwner(c);
    unlink(c, 'companyId', companyIds);
  }
  for (const d of deals) {
    fixOwner(d);
    unlink(d, 'companyId', companyIds);
    unlink(d, 'contactId', contactIds);
    d.tags = d.tags.filter((t): t is string => typeof t === 'string');
    const closed = d.stage === 'won' || d.stage === 'lost';
    if (closed && d.closedAt === null) {
      d.closedAt = d.updatedAt;
      repairs++;
    } else if (!closed && d.closedAt !== null) {
      d.closedAt = null;
      repairs++;
    }
  }
  for (const a of activities) {
    fixOwner(a);
    unlink(a, 'contactId', contactIds);
    unlink(a, 'dealId', dealIds);
  }

  return {
    db: {
      schemaVersion: SCHEMA_VERSION,
      seededAt: raw['seededAt'] as string,
      team,
      companies,
      contacts,
      deals,
      activities,
      events,
    },
    repairs,
  };
}
