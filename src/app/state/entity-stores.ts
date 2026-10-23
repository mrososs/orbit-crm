import { computed } from '@angular/core';
import { signalStore, withComputed } from '@ngrx/signals';
import {
  Activity,
  Company,
  Contact,
  Deal,
  DEAL_STAGES,
  DealStage,
  fullName,
  isOpenStage,
  TeamMember,
  TimelineEvent,
} from '../core/models';
import {
  ActivityRepository,
  CompanyRepository,
  ContactRepository,
  DealRepository,
  TeamRepository,
  TimelineRepository,
} from '../core/repositories/repositories';
import { withEntityCrud } from './with-entity-crud';

/**
 * Root-level entity stores — the client-side cache of domain data shared by every
 * feature. Cross-entity commands (cascades, timeline events) live in CrmService.
 */

function groupBy<T>(items: readonly T[], key: (item: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (k === null) continue;
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}

export const TeamStore = signalStore(
  { providedIn: 'root' },
  withEntityCrud<TeamMember>(TeamRepository),
  withComputed(({ entities }) => ({
    members: computed(() =>
      [...entities()].sort((a, b) => fullName(a).localeCompare(fullName(b))),
    ),
  })),
);

export const CompaniesStore = signalStore(
  { providedIn: 'root' },
  withEntityCrud<Company>(CompanyRepository),
  withComputed(({ entities }) => ({
    sorted: computed(() => [...entities()].sort((a, b) => a.name.localeCompare(b.name))),
  })),
);

export const ContactsStore = signalStore(
  { providedIn: 'root' },
  withEntityCrud<Contact>(ContactRepository),
  withComputed(({ entities }) => ({
    byCompany: computed(() => groupBy(entities(), (c) => c.companyId)),
    sorted: computed(() => [...entities()].sort((a, b) => fullName(a).localeCompare(fullName(b)))),
  })),
);

export const DealsStore = signalStore(
  { providedIn: 'root' },
  withEntityCrud<Deal>(DealRepository),
  withComputed(({ entities }) => ({
    openDeals: computed(() => entities().filter((d) => isOpenStage(d.stage))),
    byStage: computed(() => {
      const map = new Map<DealStage, Deal[]>(DEAL_STAGES.map((s) => [s, []]));
      for (const deal of entities()) map.get(deal.stage)!.push(deal);
      return map;
    }),
    byCompany: computed(() => groupBy(entities(), (d) => d.companyId)),
    byContact: computed(() => groupBy(entities(), (d) => d.contactId)),
  })),
);

export const ActivitiesStore = signalStore(
  { providedIn: 'root' },
  withEntityCrud<Activity>(ActivityRepository),
  withComputed(({ entities }) => ({
    open: computed(() => entities().filter((a) => a.completedAt === null)),
    byDeal: computed(() => groupBy(entities(), (a) => a.dealId)),
    byContact: computed(() => groupBy(entities(), (a) => a.contactId)),
  })),
);

export const TimelineStore = signalStore(
  { providedIn: 'root' },
  withEntityCrud<TimelineEvent>(TimelineRepository),
  withComputed(({ entities }) => ({
    /** Newest first. */
    recent: computed(() => [...entities()].sort((a, b) => b.at.localeCompare(a.at))),
  })),
);
