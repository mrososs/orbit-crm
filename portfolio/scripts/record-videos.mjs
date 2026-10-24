#!/usr/bin/env node
/**
 * Records the portfolio videos from the real production build:
 *   portfolio/videos/orbit-crm-walkthrough.mp4  (1920×1080, 30 fps, H.264)
 *   portfolio/videos/orbit-crm-short.mp4        (1080×1920, 30 fps, H.264)
 * Usage: npm run build && node portfolio/scripts/record-videos.mjs [main|short]
 */
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { ensureServer, ROOT } from './shared.mjs';
import { Director } from './video/director.mjs';
import { encode, probe, startRecording } from './video/recorder.mjs';

const OUT = join(ROOT, 'portfolio/videos');
const TMP = join(ROOT, 'portfolio/.frames');
mkdirSync(OUT, { recursive: true });

const only = process.argv[2];
const stop = await ensureServer();
const browser = await chromium.launch();

try {
  if (!only || only === 'main') await recordMain();
  if (!only || only === 'short') await recordShort();
} finally {
  await browser.close();
  stop();
  rmSync(TMP, { recursive: true, force: true });
}

async function recordMain() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3 });
  const page = await context.newPage();
  const d = new Director(page);
  await d.open({ mode: 'landscape', route: '/dashboard' });
  await d.stage('title', 'Orbit CRM <span>—</span> Modern Sales Workspace', 'Turn relationships into revenue.', ['Dashboard', 'Pipeline', 'Contacts', 'Tasks', 'Reports', 'Assistant']);
  await d.wait(900);

  const rec = await startRecording(page, join(TMP, 'main'), { width: 1920, height: 1080 });
  const app = d.app;

  // 1 — Introduction
  await d.wait(2400);
  await d.stage('hideTitle');
  await d.wait(900);
  await d.stage('caption', 'Introducing', 'Orbit CRM — Modern Sales Workspace', 'A complete sales workspace, running entirely in the browser');
  await d.glide(720, 330, 800);
  await d.wait(1100);

  // 2 — Analytics
  await d.stage('caption', 'Analytics', 'Real-time insights from connected sales data', 'KPIs and charts are derived from one reactive local dataset');
  const revenueChart = app.getByTestId('chart-revenue');
  await d.moveTo(revenueChart, { x: 0.35, y: 0.55 });
  await d.wait(700);
  await d.moveTo(revenueChart, { x: 0.62, y: 0.5 });
  await d.wait(700);
  await d.moveTo(revenueChart, { x: 0.9, y: 0.45 });
  await d.wait(600);
  await d.click(app.getByTestId('range-filter'));
  await d.wait(350);
  await d.click(app.getByRole('menuitemradio', { name: 'Last 90 days' }));
  await d.wait(1500);
  await d.scrollApp(null, 760);
  await d.wait(1500);
  await d.scrollApp(null, 0);
  await d.wait(700);
  await d.navigate('Reports');
  await d.moveTo(app.getByTestId('chart-conversion'), { x: 0.5, y: 0.55 });
  await d.wait(1000);
  await d.scrollApp(null, 520);
  await d.wait(1200);

  // 3 — Pipeline: drag a deal into Won, then see the dashboard react
  await d.stage('caption', 'Pipeline', 'Manage deals with an interactive pipeline', 'Drag & drop between stages — or use the keyboard-friendly menu');
  await d.navigate('Pipeline');
  await d.scrollApp('[data-testid="pipeline-board"]', undefined, { left: 4000 });
  await d.wait(900);
  const negotiation = app.locator('[data-testid="pipeline-column"][data-stage="negotiation"]');
  const won = app.locator('[data-testid="pipeline-column"][data-stage="won"]');
  await d.drag(negotiation.getByTestId('deal-card').first(), won.locator('.drop-list'));
  await d.wait(1400);
  await d.stage('caption', 'Pipeline', 'Winning a deal updates every metric', 'Revenue, win rate, charts and the activity feed react instantly');
  await d.navigate('Dashboard');
  await d.highlight(app.getByTestId('kpi-revenue'));
  await d.moveTo(app.getByTestId('kpi-revenue'), { x: 0.75, y: 0.55 });
  await d.wait(1700);
  await d.highlight(null);

  // 4 — Contacts
  await d.stage('caption', 'Contacts', 'Every customer relationship, organized', 'Search, filter and open rich contact profiles');
  await d.navigate('Contacts');
  await d.type(app.getByTestId('contact-search'), 'Helio');
  await d.wait(700);
  await d.click(app.getByTestId('contact-name').first());
  await d.ready();
  await d.wait(800);
  await d.click(app.getByRole('tab', { name: /Activity/ }));
  await d.wait(1400);

  // 5 — Tasks
  await d.stage('caption', 'Tasks', 'Stay on top of every opportunity', 'Overdue, today and upcoming follow-ups — completed in one click');
  await d.navigate(/^Tasks & Activities/);
  await d.click(app.getByTestId('task-toggle').first(), { pause: 400 });
  await d.wait(1100);
  await d.moveTo(app.getByTestId('completed-week'));
  await d.wait(900);

  // 6 — Interactive Demo Assistant: AG-UI events rendered as A2UI surfaces
  await d.stage('caption', 'Interactive Demo Assistant', 'Ask for a view — get live, interactive UI', 'A scripted AG-UI agent streams A2UI surfaces · no AI model, no backend');
  await d.click(app.getByTestId('assistant-toggle'), { pause: 700 });
  let replies = await d.replies();
  await d.click(app.locator('[data-testid="assistant-suggestion"][data-intent="salesOverview"]'));
  await d.assistantIdle(replies);
  await d.wait(500);
  await d.scrollPanelTo('[data-testid="assistant-surface"]');
  await d.moveTo(app.getByTestId('a2ui-kpi-revenue'), { x: 0.6, y: 0.5 });
  await d.wait(1200);
  await d.scrollPanelTo('[data-testid="a2ui-chart"]');
  await d.wait(1300);

  await d.stage('caption', 'Interactive Demo Assistant', 'Forms validated with Zod, saved through the CRM', 'Writes go through allowlisted commands — the Tasks list updates instantly');
  replies = await d.replies();
  await d.type(app.getByTestId('assistant-input'), 'Create a follow-up task', 55);
  await d.press('Enter');
  await d.assistantIdle(replies);
  await d.scrollPanelTo('[data-testid="assistant-surface"]');
  await d.wait(500);
  await d.type(app.getByTestId('followup-subject'), 'Send the Q3 renewal pricing', 55);
  await d.type(app.getByTestId('followup-contact'), 'Nim', 110);
  await d.wait(600);
  await d.press('Enter');
  await d.wait(400);
  await d.click(app.getByTestId('a2ui-form-submit'));
  await app.getByTestId('a2ui-followup-created').waitFor({ timeout: 20000 });
  await d.wait(1300);

  await d.stage('caption', 'Protocol inspector', 'Every AG-UI event, schema-checked', 'The same event stream a remote agent would send');
  await d.click(app.getByRole('tab', { name: /AG-UI events/ }), { pause: 600 });
  await d.click(app.locator('[data-testid="inspector-event"][data-type^="ACTIVITY_"]:visible').first(), { pause: 1600 });
  await d.click(app.getByTestId('assistant-close'), { pause: 600 });

  // 7 — Orbit UI form controls (Signal Forms custom controls)
  await d.stage('caption', 'Orbit UI', 'Accessible, custom form controls', 'Signal Forms custom controls · searchable selects · keyboard &amp; RTL ready');
  await d.navigate('Pipeline');
  await d.click(app.getByTestId('new-deal'), { pause: 500 });
  await d.type(app.getByTestId('deal-name'), 'Data platform expansion', 45);
  await d.type(app.getByTestId('deal-company'), 'hel', 120);
  await d.wait(700);
  await d.press('Enter');
  await d.wait(300);
  await d.click(app.getByTestId('deal-stage'), { pause: 600 });
  await d.click(app.getByTestId('deal-stage-option').filter({ hasText: 'Proposal' }), { pause: 700 });
  await d.click(app.getByRole('button', { name: 'Cancel', exact: true }), { pause: 500 });

  // 8 — Multilingual
  await d.stage('caption', 'Multilingual by design', 'English • <span class="ar">العربية</span> • Français', 'Instant switching — no reload, no lost state');
  await d.navigate('Dashboard');
  await d.click(app.getByTestId('language-switcher'));
  await d.wait(300);
  await d.click(app.getByTestId('language-option-ar'), { pause: 900 });
  await d.stage('caption', 'Full RTL support', 'Mirrored layout, localized charts', 'Arabic typography, RTL navigation and right-to-left time axes');
  await d.moveTo(app.getByTestId('chart-revenue'), { x: 0.4, y: 0.5 });
  await d.wait(1500);
  await d.click(app.getByTestId('language-switcher'));
  await d.wait(300);
  await d.click(app.getByTestId('language-option-fr'), { pause: 700 });
  await d.stage('caption', 'Multilingual by design', 'Back to LTR — en français', 'Dates, numbers and currency formatted per locale');
  await d.wait(1500);

  // 9 — Responsive & theming
  await d.stage('hideCaption');
  await d.glide(1300, 700, 500);
  await d.stage('phone', true);
  await d.wait(1200);
  await d.stage('caption', 'Responsive', 'Beautiful on every screen', 'Mobile layouts, light &amp; dark themes');
  await d.wait(500);
  await d.click(app.getByTestId('theme-toggle'), { pause: 900 });
  await d.scrollApp(null, 420);
  await d.wait(1300);

  // 10 — Closing
  await d.stage('hideCaption');
  await d.stage('title', 'Orbit CRM', 'Built with Angular, Signals, TypeScript &amp; ECharts', ['Angular 21', 'Signal Forms', 'NgRx SignalStore', 'AG-UI + A2UI', 'Zod', 'Apache ECharts', 'ngx-translate', 'Tailwind CSS']);
  await d.glide(1500, 900, 400);
  await d.wait(3000);

  const capture = await rec.stop();
  await context.close();
  const out = join(OUT, 'orbit-crm-walkthrough.mp4');
  encode(capture, out, { width: 1920, height: 1080 });
  console.log('✓ walkthrough', probe(out), `${capture.frames.length} captured frames`);
}

async function recordShort() {
  const context = await browser.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, hasTouch: false });
  const page = await context.newPage();
  const d = new Director(page);
  await d.open({ mode: 'vertical', route: '/dashboard' });
  await d.stage('headline', 'Premium <span>dashboard</span>', 'Live KPIs &amp; charts from one dataset');
  await d.wait(900);

  const rec = await startRecording(page, join(TMP, 'short'), { width: 1080, height: 1920 });
  const app = d.app;

  // 1 — Premium dashboard
  await d.glide(270, 520, 600);
  await d.wait(1200);
  await d.scrollApp(null, 1050);
  await d.wait(2400);
  await d.scrollApp(null, 1900);
  await d.wait(1800);

  // 2 — Interactive pipeline
  await d.stage('headline', 'Interactive <span>pipeline</span>', 'Drag, drop or tap to move deals');
  await d.click(app.getByTestId('mobile-menu'));
  await d.wait(500);
  await d.click(app.getByTestId('mobile-nav').getByRole('link', { name: 'Pipeline' }));
  await d.ready();
  await d.wait(900);
  await d.scrollApp(null, 300);
  await d.wait(700);
  await d.click(app.getByTestId('deal-menu').first());
  await d.wait(400);
  await d.click(app.getByTestId('move-to-qualified'), { pause: 600 });
  await d.wait(1600);

  // 3 — Interactive Demo Assistant (full-screen drawer on mobile)
  await d.stage('headline', 'Demo <span>assistant</span>', 'AG-UI events → live A2UI surfaces · no AI model');
  await d.click(app.getByTestId('assistant-toggle'), { pause: 600 });
  const replies = await d.replies();
  await d.click(app.locator('[data-testid="assistant-suggestion"][data-intent="topDeals"]'));
  await d.assistantIdle(replies);
  await d.wait(400);
  await d.scrollPanelTo('[data-testid="assistant-surface"]');
  await d.wait(2200);
  await d.click(app.getByTestId('assistant-close'), { pause: 500 });

  // 4 — Responsive & multilingual
  await d.stage('headline', 'English → <span class="ar">العربية</span>', 'Full right-to-left layout, instantly');
  await d.scrollApp(null, 0);
  await d.wait(500);
  await d.click(app.getByTestId('language-switcher'));
  await d.wait(300);
  await d.click(app.getByTestId('language-option-ar'), { pause: 1200 });
  await d.wait(900);
  await d.click(app.getByTestId('theme-toggle'), { pause: 500 });
  await d.glide(270, 640, 500);
  await d.stage('headline', 'Beautiful on <span>every screen</span>', 'Light &amp; dark · LTR &amp; RTL · Desktop &amp; mobile');
  await d.wait(2300);

  // 5 — Closing
  await d.stage('headline', 'Orbit CRM', 'Angular · Signals · AG-UI + A2UI · RTL-ready');
  await d.wait(2400);

  const capture = await rec.stop();
  await context.close();
  const out = join(OUT, 'orbit-crm-short.mp4');
  encode(capture, out, { width: 1080, height: 1920 });
  console.log('✓ short', probe(out), `${capture.frames.length} captured frames`);
}
