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

/** Opens the Interactive Demo Assistant from the top bar. */
async function openAssistant(page) {
  await page.getByTestId('assistant-toggle').click();
  await page.getByTestId('assistant-input').waitFor();
}

/** Runs a suggestion chip and waits for the simulated network and streaming to finish. */
async function runSuggestion(page, intent) {
  const replies = page.locator('[data-testid="assistant-message"][data-role="assistant"]');
  const before = await replies.count();
  await page.locator(`[data-testid="assistant-suggestion"][data-intent="${intent}"]`).click();
  await page.waitForFunction(
    (n) =>
      document.querySelectorAll('[data-testid="assistant-message"][data-role="assistant"]').length > n &&
      !document.querySelector('[data-testid="assistant-stop"]') &&
      !document.querySelector('[data-testid="assistant-status"]'),
    before,
    { timeout: 15000 },
  );
  await page.waitForTimeout(700);
}

/** Scrolls the assistant conversation so `selector` sits near the top of the panel. */
async function scrollPanelTo(page, selector) {
  await page.evaluate((s) => {
    const body = document.getElementById('assistant-panel-body');
    const target = [...body.querySelectorAll(s)].pop();
    body.scrollTop += target.getBoundingClientRect().top - body.getBoundingClientRect().top - 12;
  }, selector);
  await page.waitForTimeout(300);
}

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
  {
    file: '16-assistant-sales-overview.png',
    route: '/dashboard',
    act: async (page) => {
      await openAssistant(page);
      await runSuggestion(page, 'salesOverview');
      await scrollPanelTo(page, '[data-testid="assistant-message"][data-role="user"]');
    },
  },
  {
    file: '17-assistant-follow-up-form.png',
    route: '/activities',
    act: async (page) => {
      await openAssistant(page);
      await runSuggestion(page, 'createFollowUp');
      const form = page.getByTestId('followup-form');
      await form.getByTestId('followup-subject').fill('Send the Q3 renewal pricing');
      await form.getByTestId('followup-contact').fill('Nim');
      await page.getByTestId('followup-contact-option').first().waitFor();
      await scrollPanelTo(page, '[data-testid="assistant-surface"]');
    },
  },
  {
    file: '18-assistant-event-inspector.png',
    route: '/dashboard',
    act: async (page) => {
      await openAssistant(page);
      await runSuggestion(page, 'salesOverview');
      await page.getByRole('tab', { name: /AG-UI events/ }).click();
      await page.locator('[data-testid="inspector-event"][data-type="ACTIVITY_SNAPSHOT"]').first().click();
      await page.waitForTimeout(300);
    },
  },
  {
    file: '19-assistant-arabic-rtl.png',
    route: '/pipeline',
    lang: 'ar',
    act: async (page) => {
      await openAssistant(page);
      await runSuggestion(page, 'topDeals');
      await scrollPanelTo(page, '[data-testid="assistant-message"][data-role="user"]');
    },
  },
  {
    file: '20-mobile-assistant.png',
    route: '/dashboard',
    device: MOBILE,
    act: async (page) => {
      await openAssistant(page);
      await runSuggestion(page, 'topDeals');
      await scrollPanelTo(page, '[data-testid="assistant-message"][data-role="user"]');
    },
  },
  { file: '21-form-controls-showcase.png', route: '/showcase' },
  {
    file: '22-custom-dropdown.png',
    route: '/pipeline',
    act: async (page) => {
      await page.getByTestId('new-deal').click();
      await page.getByTestId('deal-name').fill('Data platform expansion');
      await page.getByTestId('deal-company').click();
      await page.getByTestId('deal-company-option').first().waitFor();
      await page.waitForTimeout(300);
    },
  },
];

const stop = await ensureServer();
const browser = await chromium.launch();
const errors = [];

try {
  // Optional filter: `node capture-screenshots.mjs 16 17` captures only those shots.
  const only = process.argv.slice(2);
  for (const shot of shots.filter((s) => !only.length || only.some((p) => s.file.startsWith(p)))) {
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
    await shot.act?.(page);
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
