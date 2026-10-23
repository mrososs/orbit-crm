import { inject, Injectable } from '@angular/core';
import { CollectionKey, CrmDatabase } from '../models';
import { CLOCK, STORAGE } from '../services/platform';
import { sanitizeDatabase } from './database-validation';
import { generateSeed } from './seed/generate-seed';

export const WORKSPACE_STORAGE_KEY = 'orbit-crm.workspace';

/** How the workspace was obtained on startup — surfaced to the user when relevant. */
export type LoadOutcome = 'seeded' | 'restored' | 'repaired' | 'recovered';

/**
 * Browser-backed document store for the demo. It owns the persisted snapshot;
 * mock repositories read and write through it. Swapping to a real backend means
 * replacing the repositories — this class is never used by UI code directly.
 */
@Injectable({ providedIn: 'root' })
export class LocalDatabase {
  private readonly storage = inject(STORAGE);
  private readonly clock = inject(CLOCK);
  private snapshot: CrmDatabase | null = null;
  private outcome: LoadOutcome = 'seeded';

  get loadOutcome(): LoadOutcome {
    this.ensureLoaded();
    return this.outcome;
  }

  get seededAt(): string {
    return this.ensureLoaded().seededAt;
  }

  read<K extends CollectionKey>(key: K): CrmDatabase[K] {
    return structuredClone(this.ensureLoaded()[key]);
  }

  /** Applies a mutation to one collection and persists the whole snapshot. */
  write<K extends CollectionKey>(key: K, mutate: (items: CrmDatabase[K]) => CrmDatabase[K]): void {
    const db = this.ensureLoaded();
    db[key] = mutate(db[key]);
    this.persist(db);
  }

  exportSnapshot(): CrmDatabase {
    return structuredClone(this.ensureLoaded());
  }

  /** Discards all changes and regenerates the seeded workspace. */
  reset(): void {
    this.snapshot = generateSeed(this.clock());
    this.outcome = 'seeded';
    this.persist(this.snapshot);
  }

  /** Approximate persisted size in bytes. */
  storageSize(): number {
    return (this.storage.getItem(WORKSPACE_STORAGE_KEY) ?? '').length * 2;
  }

  private ensureLoaded(): CrmDatabase {
    if (this.snapshot) return this.snapshot;

    const raw = this.storage.getItem(WORKSPACE_STORAGE_KEY);
    if (raw === null) {
      this.snapshot = generateSeed(this.clock());
      this.outcome = 'seeded';
      this.persist(this.snapshot);
      return this.snapshot;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = undefined;
    }

    const result = sanitizeDatabase(parsed);
    if (!result) {
      // Corrupted or outdated schema: start over from the seed.
      this.snapshot = generateSeed(this.clock());
      this.outcome = 'recovered';
      this.persist(this.snapshot);
      return this.snapshot;
    }

    this.snapshot = result.db;
    this.outcome = result.repairs > 0 ? 'repaired' : 'restored';
    if (result.repairs > 0) this.persist(this.snapshot);
    return this.snapshot;
  }

  private persist(db: CrmDatabase): void {
    try {
      this.storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(db));
    } catch (error) {
      // Quota exceeded or storage revoked — keep working in memory.
      console.warn('[Orbit CRM] Unable to persist workspace', error);
    }
  }
}
