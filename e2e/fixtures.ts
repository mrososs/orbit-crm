import { expect, Page, test as base } from '@playwright/test';

/** Fails a test when the page logs errors or throws — a quality gate for every scenario. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await use(errors);
    expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
  },
});

export { expect };

/** Opens a route and waits until workspace data has rendered (skeletons gone). */
export async function openApp(page: Page, path = '/dashboard'): Promise<void> {
  await page.goto(path);
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('main .skeleton').first()).toHaveCount(0, { timeout: 10_000 });
}

/** Reads a number from formatted text such as "$1,140,000" or "64%". */
export function parseNumber(text: string | null): number {
  return Number((text ?? '').replace(/[^\d.-]/g, ''));
}

/**
 * Picks an option in an Orbit dropdown (`ui-select`, a styled listbox): opens it
 * and clicks the option with this exact accessible name.
 */
export async function pickOption(page: Page, testId: string, label: string): Promise<void> {
  await page.getByTestId(testId).click();
  await page.getByTestId(`${testId}-panel`).getByRole('option', { name: label, exact: true }).click();
  await expect(page.getByTestId(`${testId}-panel`)).toHaveCount(0);
}

export async function switchLanguage(page: Page, code: 'en' | 'ar' | 'fr'): Promise<void> {
  await page.getByTestId('language-switcher').click();
  await page.getByTestId(`language-option-${code}`).click();
  await expect(page.locator('html')).toHaveAttribute('lang', code);
}

/**
 * Pointer-driven drag for CDK drag & drop (CDK needs intermediate pointer moves).
 */
export async function dragAndDrop(page: Page, source: ReturnType<Page['locator']>, target: ReturnType<Page['locator']>): Promise<void> {
  await source.scrollIntoViewIfNeeded();
  const from = (await source.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + 24);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 8, from.y + 30, { steps: 4 });
  await target.scrollIntoViewIfNeeded();
  const to = (await target.boundingBox())!;
  await page.mouse.move(to.x + to.width / 2, to.y + Math.min(80, to.height / 2), { steps: 16 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}
