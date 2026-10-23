/** Shared helpers for portfolio media capture (screenshots and video). */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const PORT = Number(process.env.MEDIA_PORT ?? 4311);
export const BASE = `http://localhost:${PORT}`;

/** Starts the production-build server unless one is already listening. */
export async function ensureServer() {
  if (await reachable()) return () => undefined;
  const child = spawn(process.execPath, ['scripts/serve-dist.mjs', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    if (await reachable()) return () => child.kill();
    await new Promise((r) => setTimeout(r, 200));
  }
  child.kill();
  throw new Error('Could not start the production server — run `npm run build` first.');
}

async function reachable() {
  try {
    const res = await fetch(BASE);
    return res.ok;
  } catch {
    return false;
  }
}

/** Seeds per-page preferences before the app boots. */
export async function preparePage(page, { lang = 'en', theme = 'light' } = {}) {
  await page.addInitScript(
    ({ lang, theme }) => {
      localStorage.setItem('orbit-crm.language', lang);
      localStorage.setItem('orbit-crm.preferences', JSON.stringify({ theme }));
    },
    { lang, theme },
  );
}

/** Hides scrollbars for clean captures (presentation only, not an app change). */
export const CLEAN_CSS = `
  * { scrollbar-width: none !important; }
  *::-webkit-scrollbar { display: none !important; }
  ui-toaster { display: none !important; }
`;

export async function waitForApp(page) {
  await page.waitForFunction(() => document.querySelectorAll('main .skeleton').length === 0, null, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
}

/** Reads the persisted workspace to pick representative records. */
export async function workspace(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('orbit-crm.workspace') ?? '{}'));
}

export function pickShowcaseDeal(db) {
  const openTasks = new Set(db.activities.filter((a) => !a.completedAt && a.dealId).map((a) => a.dealId));
  return (
    db.deals.find((d) => d.stage === 'negotiation' && d.notes && openTasks.has(d.id)) ??
    db.deals.find((d) => d.stage === 'negotiation') ??
    db.deals[0]
  );
}

export function pickShowcaseContact(db) {
  const dealCount = (id) => db.deals.filter((d) => d.contactId === id).length;
  const activityCount = (id) => db.activities.filter((a) => a.contactId === id).length;
  const score = (c) => dealCount(c.id) * 10 + activityCount(c.id) + (c.notes ? 15 : 0);
  return [...db.contacts]
    .filter((c) => c.status === 'customer')
    .sort((a, b) => score(b) - score(a))[0];
}
