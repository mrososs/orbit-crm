#!/usr/bin/env node
/**
 * Visual QA sweep: captures every route at desktop / tablet / mobile widths in
 * each language and reports horizontal overflow and console errors.
 * Usage: node scripts/qa-capture.mjs <outDir> [baseUrl]
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const outDir = process.argv[2] ?? 'qa-shots';
const base = process.argv[3] ?? 'http://localhost:4310';
const langs = (process.env.QA_LANGS ?? 'en,ar,fr').split(',');
const viewports = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};
const only = process.env.QA_VIEWPORTS?.split(',');
const routes = (process.env.QA_ROUTES ?? '/dashboard,/pipeline,/deals/dl_041,/contacts,/contacts/ct_010,/companies,/companies/co_004,/activities,/reports,/settings').split(',');

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const problems = [];

for (const [name, viewport] of Object.entries(viewports)) {
  if (only && !only.includes(name)) continue;
  for (const lang of langs) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((code) => localStorage.setItem('orbit-crm.language', code), lang);
    if (process.env.QA_DARK) {
      await page.addInitScript(() => localStorage.setItem('orbit-crm.preferences', JSON.stringify({ theme: 'dark' })));
    }

    for (const route of routes) {
      await page.goto(base + route, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.querySelectorAll('main .skeleton').length === 0, null, { timeout: 15000 }).catch(() => undefined);
      await page.waitForTimeout(700);
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        const offenders = [];
        if (doc.scrollWidth > window.innerWidth + 1) {
          for (const el of document.querySelectorAll('main *')) {
            const r = el.getBoundingClientRect();
            if (r.right > window.innerWidth + 1 || r.left < -1) {
              const scroller = el.closest('.overflow-x-auto, [cdkScrollable], .board');
              if (!scroller) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')}`);
            }
            if (offenders.length > 4) break;
          }
        }
        return { page: doc.scrollWidth - window.innerWidth, offenders };
      });
      if (overflow.page > 1) problems.push(`${name}/${lang}${route}: horizontal overflow ${overflow.page}px ${overflow.offenders.join(', ')}`);
      const file = join(outDir, `${name}-${lang}${route.replaceAll('/', '_')}.png`);
      await page.screenshot({ path: file, fullPage: process.env.QA_FULL === '1' });
    }
    if (errors.length) problems.push(`${name}/${lang}: console errors: ${[...new Set(errors)].join(' | ')}`);
    await context.close();
  }
}

await browser.close();
console.log(problems.length ? `Problems:\n${problems.join('\n')}` : 'No overflow or console errors detected.');
