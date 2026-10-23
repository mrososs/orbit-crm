import { Activity, Company, Contact, CrmDatabase, Deal, Entity, TeamMember, TimelineEvent } from '../models';

/**
 * Repository contracts. UI and stores depend only on these abstract classes
 * (used as DI tokens). The demo binds them to browser-storage implementations;
 * an HTTP implementation can be provided instead without touching the UI.
 */
export abstract class CrudRepository<T extends Entity> {
  abstract list(): Promise<T[]>;
  abstract create(entity: T): Promise<T>;
  abstract update(id: string, changes: Partial<T>): Promise<T>;
  abstract remove(id: string): Promise<void>;
}

export abstract class TeamRepository extends CrudRepository<TeamMember> {}
export abstract class CompanyRepository extends CrudRepository<Company> {}
export abstract class ContactRepository extends CrudRepository<Contact> {}
export abstract class DealRepository extends CrudRepository<Deal> {}
export abstract class ActivityRepository extends CrudRepository<Activity> {}
export abstract class TimelineRepository extends CrudRepository<TimelineEvent> {}

export interface WorkspaceInfo {
  seededAt: string;
  outcome: 'seeded' | 'restored' | 'repaired' | 'recovered';
  storageBytes: number;
}

/** Workspace-level operations (demo lifecycle). */
export abstract class WorkspaceRepository {
  abstract info(): Promise<WorkspaceInfo>;
  abstract reset(): Promise<WorkspaceInfo>;
  abstract exportSnapshot(): Promise<CrmDatabase>;
}

export class NotFoundError extends Error {
  constructor(collection: string, id: string) {
    super(`${collection}/${id} not found`);
    this.name = 'NotFoundError';
  }
}
