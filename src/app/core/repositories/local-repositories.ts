import { AbstractType, EnvironmentProviders, inject, makeEnvironmentProviders } from '@angular/core';
import { LocalDatabase } from '../data/local-database';
import { CollectionKey, CrmDatabase } from '../models';
import { delay, MOCK_LATENCY } from '../services/platform';
import {
  ActivityRepository,
  CompanyRepository,
  ContactRepository,
  CrudRepository,
  DealRepository,
  NotFoundError,
  TeamRepository,
  TimelineRepository,
  WorkspaceInfo,
  WorkspaceRepository,
} from './repositories';

type Item<K extends CollectionKey> = CrmDatabase[K][number];

/** Generic browser-storage implementation of `CrudRepository` for one collection. */
export class LocalCollectionRepository<K extends CollectionKey> extends CrudRepository<Item<K>> {
  private readonly db = inject(LocalDatabase);
  private readonly latency = inject(MOCK_LATENCY);

  constructor(private readonly key: K) {
    super();
  }

  async list(): Promise<Item<K>[]> {
    await delay(this.latency.read);
    return this.db.read(this.key) as Item<K>[];
  }

  async create(entity: Item<K>): Promise<Item<K>> {
    await delay(this.latency.write);
    const copy = structuredClone(entity);
    this.db.write(this.key, (items) => [...(items as Item<K>[]), copy] as CrmDatabase[K]);
    return structuredClone(copy);
  }

  async update(id: string, changes: Partial<Item<K>>): Promise<Item<K>> {
    await delay(this.latency.write);
    let updated: Item<K> | undefined;
    this.db.write(
      this.key,
      (items) =>
        (items as Item<K>[]).map((item) => {
          if (item.id !== id) return item;
          updated = { ...item, ...structuredClone(changes), id } as Item<K>;
          return updated;
        }) as CrmDatabase[K],
    );
    if (!updated) throw new NotFoundError(this.key, id);
    return structuredClone(updated);
  }

  async remove(id: string): Promise<void> {
    await delay(this.latency.write);
    this.db.write(this.key, (items) => (items as Item<K>[]).filter((i) => i.id !== id) as CrmDatabase[K]);
  }
}

export class LocalWorkspaceRepository extends WorkspaceRepository {
  private readonly db = inject(LocalDatabase);
  private readonly latency = inject(MOCK_LATENCY);

  async info(): Promise<WorkspaceInfo> {
    return {
      seededAt: this.db.seededAt,
      outcome: this.db.loadOutcome,
      storageBytes: this.db.storageSize(),
    };
  }

  async reset(): Promise<WorkspaceInfo> {
    await delay(this.latency.write * 4);
    this.db.reset();
    return this.info();
  }

  async exportSnapshot(): Promise<CrmDatabase> {
    return this.db.exportSnapshot();
  }
}

const collection = <K extends CollectionKey>(token: AbstractType<unknown>, key: K) => ({
  provide: token,
  useFactory: () => new LocalCollectionRepository(key),
});

/** Binds every repository contract to its browser-storage implementation. */
export function provideLocalRepositories(): EnvironmentProviders {
  return makeEnvironmentProviders([
    collection(TeamRepository, 'team'),
    collection(CompanyRepository, 'companies'),
    collection(ContactRepository, 'contacts'),
    collection(DealRepository, 'deals'),
    collection(ActivityRepository, 'activities'),
    collection(TimelineRepository, 'events'),
    { provide: WorkspaceRepository, useClass: LocalWorkspaceRepository },
  ]);
}
