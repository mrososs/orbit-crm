#!/usr/bin/env node
/**
 * Captures portfolio screenshots from the real production build.
 * Usage: npm run build && node portfolio/scripts/capture-screenshots.mjs
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import {
  BASE,
  CLEAN_CSS,
  ensureServer,
  pickShowcaseContact,
  pickShowcaseDeal,
  preparePage,
  ROOT,
  waitForApp,
  workspace,
} from './shared.mjs';

const OUT = join(ROOT, 'portfolio/screenshots');
mkdirSync(OUT, { recursive: true });

const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

const shots = [
  { file: '01-dashboard-desktop.png', route: '/dashboard' },
  { file: '02-sales-pipeline.png', route: '/pipeline' },
  { file: '03-deal-details.png', route: (db) => `/deals/${pickShowcaseDeal(db).id}` },
  { file: '04-contacts-management.png', route: '/contacts' },
  { file: '05-contact-details.png', route: (db) => `/contacts/${pickShowcaseContact(db).id}` },
  { file: '06-companies.png', route: '/companies' },
  { file: '07-reports-analytics.png', route: '/reports' },
  { file: '08-mobile-dashboard.png', route: '/dashboard', device: MOBILE },
  { file: '09-mobile-pipeline.png', route: '/pipeline', device: MOBILE },
  { file: '10-dark-mode.png', route: '/dashboard', theme: 'dark' },
  { file: '11-dashboard-arabic-rtl.png', route: '/dashboard', lang: 'ar' },
  { file: '12-pipeline-arabic-rtl.png', route: '/pipeline', lang: 'ar' },
  { file: '13-contacts-arabic-rtl.png', route: '/contacts', lang: 'ar' },
  { file: '14-dashboard-french.png', route: '/dashboard', lang: 'fr' },
  { file: '15-mobile-arabic-rtl.png', route: '/dashboard', lang: 'ar', device: MOBILE },
];

const stop = await ensureServer();
const browser = await chromium.launch();
const errors = [];

try {
  for (const shot of shots) {
    const context = await browser.newContext({ ...(shot.device ?? DESKTOP), reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('console', (m) => m.type() === 'error' && errors.push(`${shot.file}: ${m.text()}`));
    page.on('pageerror', (e) => errors.push(`${shot.file}: ${e.message}`));
    await preparePage(page, { lang: shot.lang, theme: shot.theme });

    let route = shot.route;
    if (typeof route === 'function') {
      await page.goto(`${BASE}/dashboard`);
      await waitForApp(page);
      route = route(await workspace(page));
    }
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: CLEAN_CSS });
    await waitForApp(page);
    await page.mouse.move(0, 0);
    await page.screenshot({ path: join(OUT, shot.file) });
    console.log(`✓ ${shot.file}  ${route}`);
    await context.close();
  }
} finally {
  await browser.close();
  stop();
}

if (errors.length) {
  console.error(`Console errors during capture:\n${errors.join('\n')}`);
  process.exit(1);
}
