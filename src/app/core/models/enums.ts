/**
 * Domain enumerations. Values are stable identifiers persisted in storage —
 * display labels come from the i18n dictionaries (`enums.*` keys), never from here.
 */

export const DEAL_STAGES = ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const OPEN_STAGES = ['new', 'qualified', 'proposal', 'negotiation'] as const;
export type OpenStage = (typeof OPEN_STAGES)[number];

export const CLOSED_STAGES = ['won', 'lost'] as const;
export type ClosedStage = (typeof CLOSED_STAGES)[number];

/** Default win probability per stage, used for weighted pipeline value. */
export const STAGE_PROBABILITY: Readonly<Record<DealStage, number>> = {
  new: 10,
  qualified: 25,
  proposal: 50,
  negotiation: 75,
  won: 100,
  lost: 0,
};

export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_WEIGHT: Readonly<Record<Priority, number>> = { low: 0, medium: 1, high: 2 };

export const CONTACT_STATUSES = ['lead', 'prospect', 'customer', 'churned'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const LEAD_SOURCES = ['website', 'referral', 'linkedin', 'event', 'outbound', 'partner'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const ACTIVITY_TYPES = ['call', 'meeting', 'email', 'follow-up'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const INDUSTRIES = [
  'software',
  'fintech',
  'healthcare',
  'retail',
  'manufacturing',
  'logistics',
  'media',
  'education',
  'energy',
  'hospitality',
] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

export const TEAM_ROLES = ['sales-manager', 'account-executive', 'sdr'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export function isOpenStage(stage: DealStage): stage is OpenStage {
  return (OPEN_STAGES as readonly string[]).includes(stage);
}

export function isClosedStage(stage: DealStage): stage is ClosedStage {
  return stage === 'won' || stage === 'lost';
}

export function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}
