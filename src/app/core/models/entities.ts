import {
  ActivityType,
  CompanySize,
  ContactStatus,
  DealStage,
  Industry,
  LeadSource,
  OpenStage,
  Priority,
  TeamRole,
} from './enums';

/** ISO-8601 timestamp, e.g. `2026-05-14T09:30:00.000Z`. */
export type IsoDateTime = string;
/** Calendar date, e.g. `2026-05-14`. */
export type IsoDate = string;

export interface Entity {
  id: string;
}

export interface TeamMember extends Entity {
  firstName: string;
  lastName: string;
  email: string;
  role: TeamRole;
  /** Quarterly revenue quota in the workspace currency. */
  quarterlyQuota: number;
  joinedAt: IsoDate;
}

export interface Company extends Entity {
  name: string;
  website: string;
  industry: Industry;
  size: CompanySize;
  city: string;
  /** ISO 3166-1 alpha-2 — rendered with `Intl.DisplayNames` in the active locale. */
  countryCode: string;
  ownerId: string;
  description: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface Contact extends Entity {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  companyId: string | null;
  status: ContactStatus;
  source: LeadSource;
  ownerId: string;
  notes: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  lastInteractionAt: IsoDateTime | null;
}

export interface Deal extends Entity {
  name: string;
  companyId: string | null;
  contactId: string | null;
  /** Monetary value in the workspace currency (see WORKSPACE_CURRENCY). */
  value: number;
  stage: DealStage;
  priority: Priority;
  ownerId: string;
  source: LeadSource;
  expectedCloseDate: IsoDate;
  tags: string[];
  notes: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  /** Set when the deal enters Won or Lost; cleared when reopened. */
  closedAt: IsoDateTime | null;
  /** The last open stage a lost deal reached — powers the conversion funnel. */
  lostAtStage: OpenStage | null;
}

export interface Activity extends Entity {
  type: ActivityType;
  subject: string;
  description: string;
  dueAt: IsoDateTime;
  completedAt: IsoDateTime | null;
  priority: Priority;
  ownerId: string;
  contactId: string | null;
  dealId: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export const TIMELINE_EVENT_KINDS = [
  'deal-created',
  'deal-stage-changed',
  'deal-won',
  'deal-lost',
  'contact-created',
  'company-created',
  'activity-completed',
] as const;
export type TimelineEventKind = (typeof TIMELINE_EVENT_KINDS)[number];

/** Immutable audit-style record that powers activity feeds and timelines. */
export interface TimelineEvent extends Entity {
  kind: TimelineEventKind;
  at: IsoDateTime;
  actorId: string;
  dealId: string | null;
  contactId: string | null;
  companyId: string | null;
  activityId: string | null;
  /** Snapshot of the subject's display name, used if the record is later deleted. */
  label: string;
  fromStage?: DealStage;
  toStage?: DealStage;
  value?: number;
}

export interface CrmDatabase {
  schemaVersion: number;
  /** Anchor timestamp the seed was generated against. */
  seededAt: IsoDateTime;
  team: TeamMember[];
  companies: Company[];
  contacts: Contact[];
  deals: Deal[];
  activities: Activity[];
  events: TimelineEvent[];
}

export type CollectionKey = Exclude<keyof CrmDatabase, 'schemaVersion' | 'seededAt'>;

export const WORKSPACE_CURRENCY = 'USD';
