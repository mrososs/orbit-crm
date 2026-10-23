#!/usr/bin/env node
/** Renders the cover image and video poster from their HTML compositions. */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { ROOT } from './shared.mjs';

const artwork = [
  { src: 'portfolio/cover/src/cover.html', out: 'portfolio/cover/orbit-crm-cover.png' },
  { src: 'portfolio/cover/src/poster.html', out: 'portfolio/cover/orbit-crm-video-poster.png' },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
for (const item of artwork) {
  await page.goto(pathToFileURL(join(ROOT, item.src)).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(ROOT, item.out) });
  console.log(`✓ ${item.out}`);
}
await browser.close();
