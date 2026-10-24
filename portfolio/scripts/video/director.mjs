/**
 * Scene-direction helpers: a visible, smoothly animated cursor that drives real
 * pointer events inside the app iframe, plus stage overlays (captions, titles).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, ROOT } from '../shared.mjs';

const STAGE_HTML = readFileSync(join(ROOT, 'portfolio/scripts/video/stage.html'), 'utf8');
const MEDIA = {
  'inter.woff2': 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  'plex-arabic-600.woff2': 'node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-600-normal.woff2',
};

export class Director {
  constructor(page) {
    this.page = page;
    this.pos = { x: -100, y: -100 };
  }

  /** Serves the stage on the app's origin so the iframe shares storage and events. */
  async open({ mode = 'landscape', lang = 'en', theme = 'light', route = '/dashboard' } = {}) {
    const { page } = this;
    await page.route(`${BASE}/__stage`, (r) => r.fulfill({ body: STAGE_HTML, contentType: 'text/html; charset=utf-8' }));
    await page.route(`${BASE}/__media/*`, (r) => {
      const name = r.request().url().split('/').pop();
      return r.fulfill({ path: join(ROOT, MEDIA[name]), contentType: 'font/woff2' });
    });
    await page.addInitScript(
      ({ lang, theme }) => {
        if (window.top === window) return;
        if (!sessionStorage.getItem('orbit-media-init')) {
          sessionStorage.setItem('orbit-media-init', '1');
          localStorage.removeItem('orbit-crm.workspace');
          localStorage.setItem('orbit-crm.language', lang);
          localStorage.setItem('orbit-crm.preferences', JSON.stringify({ theme }));
        }
      },
      { lang, theme },
    );
    await page.goto(`${BASE}/__stage`);
    await page.evaluate((m) => window.stage.mode(m), mode);
    await page.evaluate((url) => window.stage.load(url), `${BASE}${route}`);
    this.frame = page.frame({ name: 'app' });
    await this.ready();
  }

  get app() {
    return this.page.frameLocator('#app-frame');
  }

  async ready() {
    await this.frame.waitForFunction(() => document.querySelectorAll('main .skeleton').length === 0, null, { timeout: 20000 });
    await this.frame.evaluate(() => document.fonts.ready);
  }

  wait(ms) {
    return this.page.waitForTimeout(ms);
  }

  stage(method, ...args) {
    return this.page.evaluate(([m, a]) => window.stage[m](...a), [method, args]);
  }

  async center(locator, offset = { x: 0.5, y: 0.5 }) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    if (!box) throw new Error('Element not visible');
    return { x: box.x + box.width * offset.x, y: box.y + box.height * offset.y, box };
  }

  /** Glides the visible cursor (and the real pointer) to a point. */
  async glide(x, y, ms) {
    const distance = Math.hypot(x - this.pos.x, y - this.pos.y);
    const duration = ms ?? Math.min(1100, Math.max(420, distance * 0.9));
    await this.stage('cursor', x, y, duration);
    await this.page.mouse.move(x, y, { steps: Math.max(8, Math.round(duration / 30)) });
    await this.wait(Math.max(0, duration - 150));
    this.pos = { x, y };
  }

  async moveTo(locator, offset) {
    const { x, y } = await this.center(locator, offset);
    await this.glide(x, y);
  }

  async click(locator, { offset, pause = 250 } = {}) {
    const { x, y } = await this.center(locator, offset);
    await this.glide(x, y);
    await this.wait(120);
    await this.stage('ripple', x, y);
    await this.page.mouse.click(x, y);
    await this.wait(pause);
  }

  async type(locator, text, delay = 85) {
    await this.click(locator);
    await this.page.keyboard.type(text, { delay });
  }

  /** Slow, visible drag between two elements (CDK-friendly pointer path). */
  async drag(source, target, { targetOffset = { x: 0.5, y: 0.35 } } = {}) {
    const from = await this.center(source, { x: 0.5, y: 0.22 });
    await this.glide(from.x, from.y);
    await this.page.mouse.down();
    await this.page.mouse.move(from.x + 6, from.y + 6, { steps: 4 });
    const to = await this.center(target, targetOffset);
    const steps = 40;
    await this.stage('cursor', to.x, to.y, 1300);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      await this.page.mouse.move(from.x + (to.x - from.x) * ease, from.y + (to.y - from.y) * ease - Math.sin(t * Math.PI) * 30);
      await this.wait(30);
    }
    await this.wait(250);
    await this.page.mouse.up();
    this.pos = { x: to.x, y: to.y };
  }

  async scrollApp(selector, top, { smooth = true, left } = {}) {
    await this.frame.evaluate(
      ({ selector, top, left, smooth }) => {
        const el = selector ? document.querySelector(selector) : document.scrollingElement;
        el.scrollTo({ top: top ?? el.scrollTop, left: left ?? el.scrollLeft, behavior: smooth ? 'smooth' : 'auto' });
      },
      { selector, top, left, smooth },
    );
  }

  press(key) {
    return this.page.keyboard.press(key);
  }

  /** Number of assistant replies so far (to detect when the next run has finished). */
  replies() {
    return this.app.locator('[data-testid="assistant-message"][data-role="assistant"]').count();
  }

  /** Waits for the assistant run (simulated network + streaming) to finish. */
  async assistantIdle(previousReplies) {
    await this.frame.waitForFunction(
      (n) =>
        document.querySelectorAll('[data-testid="assistant-message"][data-role="assistant"]').length > n &&
        !document.querySelector('[data-testid="assistant-stop"]') &&
        !document.querySelector('[data-testid="assistant-status"]'),
      previousReplies,
      { timeout: 20000 },
    );
  }

  /** Smoothly scrolls the assistant conversation so the last `selector` match sits at the top. */
  async scrollPanelTo(selector, offset = 12) {
    await this.frame.evaluate(
      ({ selector, offset }) => {
        const body = document.getElementById('assistant-panel-body');
        const target = [...body.querySelectorAll(selector)].pop();
        const top = body.scrollTop + target.getBoundingClientRect().top - body.getBoundingClientRect().top - offset;
        body.scrollTo({ top, behavior: 'smooth' });
      },
      { selector, offset },
    );
  }

  async highlight(locator, pad = 6) {
    if (!locator) return this.stage('highlight', null);
    const box = await locator.boundingBox();
    return this.stage('highlight', box, pad);
  }

  /** In-app navigation through a real sidebar/link click. */
  async navigate(name) {
    await this.click(this.app.getByRole('link', typeof name === 'string' ? { name, exact: true } : { name }).first());
    await this.ready();
    await this.wait(500);
  }
}
