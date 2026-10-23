import { TestBed } from '@angular/core/testing';
import { provideTestEnvironment, TEST_NOW } from '../../../testing/test-providers';
import { MemoryStorage } from '../services/platform';
import { sanitizeDatabase } from './database-validation';
import { LocalDatabase, WORKSPACE_STORAGE_KEY } from './local-database';
import { generateSeed, SCHEMA_VERSION } from './seed/generate-seed';

function createDatabase(storage: Storage): LocalDatabase {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: provideTestEnvironment({ storage }) });
  return TestBed.inject(LocalDatabase);
}

describe('LocalDatabase persistence', () => {
  it('seeds and persists a workspace when storage is empty', () => {
    const storage = new MemoryStorage();
    const db = createDatabase(storage);
    expect(db.read('deals')).toHaveLength(80);
    expect(db.loadOutcome).toBe('seeded');
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toContain('"schemaVersion":1');
  });

  it('restores previously saved changes after a reload', () => {
    const storage = new MemoryStorage();
    const first = createDatabase(storage);
    first.write('companies', (items) => items.map((c) => (c.id === 'co_001' ? { ...c, name: 'Renamed Co' } : c)));

    const second = createDatabase(storage);
    expect(second.loadOutcome).toBe('restored');
    expect(second.read('companies').find((c) => c.id === 'co_001')!.name).toBe('Renamed Co');
  });

  it('repairs dangling references left by an incomplete write', () => {
    const storage = new MemoryStorage();
    createDatabase(storage).write('companies', (items) => items.filter((c) => c.id !== 'co_001'));
    const reloaded = createDatabase(storage);
    expect(reloaded.loadOutcome).toBe('repaired');
    expect(reloaded.read('contacts').some((c) => c.companyId === 'co_001')).toBe(false);
  });

  it('recovers from corrupted JSON by restoring the seed', () => {
    const storage = new MemoryStorage();
    storage.setItem(WORKSPACE_STORAGE_KEY, '{not json');
    const db = createDatabase(storage);
    expect(db.loadOutcome).toBe('recovered');
    expect(db.read('contacts')).toHaveLength(100);
  });

  it('discards data written by an outdated schema version', () => {
    const storage = new MemoryStorage();
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({ ...generateSeed(TEST_NOW), schemaVersion: 0 }));
    expect(createDatabase(storage).loadOutcome).toBe('recovered');
  });

  it('reset regenerates the original dataset', () => {
    const storage = new MemoryStorage();
    const db = createDatabase(storage);
    db.write('deals', () => []);
    expect(db.read('deals')).toHaveLength(0);
    db.reset();
    expect(db.read('deals')).toHaveLength(80);
    expect(db.read('deals')).toEqual(generateSeed(TEST_NOW).deals);
  });

  it('returns copies so callers cannot mutate the stored snapshot', () => {
    const db = createDatabase(new MemoryStorage());
    const deals = db.read('deals');
    deals[0].value = -1;
    expect(db.read('deals')[0].value).not.toBe(-1);
  });
});

describe('sanitizeDatabase', () => {
  const seed = () => JSON.parse(JSON.stringify(generateSeed(TEST_NOW)));

  it('rejects payloads with the wrong shape or schema', () => {
    expect(sanitizeDatabase(null)).toBeNull();
    expect(sanitizeDatabase({ schemaVersion: SCHEMA_VERSION })).toBeNull();
    expect(sanitizeDatabase({ ...seed(), schemaVersion: 99 })).toBeNull();
  });

  it('drops invalid records and unlinks dangling relationships', () => {
    const raw = seed();
    raw.deals[0].stage = 'unknown-stage';
    raw.contacts[0].companyId = 'co_missing';
    raw.activities[0].dealId = 'dl_missing';
    raw.deals[1].ownerId = 'tm_ghost';

    const result = sanitizeDatabase(raw)!;
    expect(result.db.deals).toHaveLength(79);
    expect(result.db.contacts[0].companyId).toBeNull();
    expect(result.db.activities[0].dealId).toBeNull();
    expect(result.db.deals.find((d) => d.id === raw.deals[1].id)!.ownerId).toBe('tm_alex');
    expect(result.repairs).toBeGreaterThanOrEqual(4);
  });

  it('repairs inconsistent close dates', () => {
    const raw = seed();
    const won = raw.deals.find((d: { stage: string }) => d.stage === 'won');
    won.closedAt = null;
    const open = raw.deals.find((d: { stage: string }) => d.stage === 'new');
    open.closedAt = '2026-01-01T00:00:00.000Z';
    const result = sanitizeDatabase(raw)!;
    expect(result.db.deals.find((d) => d.id === won.id)!.closedAt).not.toBeNull();
    expect(result.db.deals.find((d) => d.id === open.id)!.closedAt).toBeNull();
  });
});
