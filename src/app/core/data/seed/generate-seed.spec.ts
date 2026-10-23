import { isOpenStage } from '../../models';
import { sanitizeDatabase } from '../database-validation';
import { generateSeed } from './generate-seed';

const ANCHOR = new Date(2026, 5, 15, 9, 30);
const YEAR_MS = 366 * 86_400_000;

describe('seed dataset', () => {
  const db = generateSeed(ANCHOR);

  it('is deterministic for the same anchor date', () => {
    expect(generateSeed(new Date(ANCHOR))).toEqual(db);
  });

  it('contains the documented volume of records', () => {
    expect(db.team).toHaveLength(8);
    expect(db.companies).toHaveLength(30);
    expect(db.contacts).toHaveLength(100);
    expect(db.deals).toHaveLength(80);
    expect(db.activities).toHaveLength(120);
    expect(db.events.length).toBeGreaterThan(200);
  });

  it('only references existing records', () => {
    const ids = (items: { id: string }[]) => new Set(items.map((i) => i.id));
    const team = ids(db.team);
    const companies = ids(db.companies);
    const contacts = ids(db.contacts);
    const deals = ids(db.deals);

    for (const c of db.contacts) {
      expect(team.has(c.ownerId)).toBe(true);
      expect(c.companyId === null || companies.has(c.companyId)).toBe(true);
    }
    for (const d of db.deals) {
      expect(team.has(d.ownerId)).toBe(true);
      expect(companies.has(d.companyId!)).toBe(true);
      expect(contacts.has(d.contactId!)).toBe(true);
    }
    for (const a of db.activities) {
      expect(a.dealId === null || deals.has(a.dealId)).toBe(true);
      expect(a.contactId === null || contacts.has(a.contactId)).toBe(true);
    }
    // A fully consistent dataset needs no repairs.
    expect(sanitizeDatabase(JSON.parse(JSON.stringify(db)))!.repairs).toBe(0);
  });

  it('keeps close dates coherent with stages and within the last 12 months', () => {
    const today = new Date(2026, 5, 15).getTime();
    for (const d of db.deals) {
      if (isOpenStage(d.stage)) {
        expect(d.closedAt).toBeNull();
      } else {
        const closed = new Date(d.closedAt!).getTime();
        expect(closed).toBeLessThan(today);
        expect(today - closed).toBeLessThan(YEAR_MS);
        expect(new Date(d.createdAt).getTime()).toBeLessThan(closed);
      }
      if (d.stage === 'lost') expect(d.lostAtStage).not.toBeNull();
    }
  });

  it('never creates completed activities in the future', () => {
    for (const a of db.activities.filter((x) => x.completedAt)) {
      expect(new Date(a.completedAt!).getTime()).toBeLessThan(ANCHOR.getTime() + 86_400_000);
    }
  });

  it('includes overdue, due-today and upcoming open tasks', () => {
    const today = new Date(2026, 5, 15);
    const open = db.activities.filter((a) => a.completedAt === null);
    expect(open.some((a) => new Date(a.dueAt) < today)).toBe(true);
    expect(open.some((a) => new Date(a.dueAt).toDateString() === today.toDateString())).toBe(true);
    expect(open.some((a) => new Date(a.dueAt) > new Date(2026, 5, 16))).toBe(true);
  });
});
