import { expect, openApp, switchLanguage, test } from './fixtures';

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe('Mobile', () => {
  test('navigates with the mobile drawer', async ({ page, consoleErrors }) => {
    await openApp(page, '/dashboard');
    await expect(page.locator('aside').first()).toBeHidden();
    await expectNoHorizontalOverflow(page);

    await page.getByTestId('mobile-menu').click();
    const drawer = page.getByTestId('mobile-nav');
    await expect(drawer).toBeVisible();
    await drawer.getByRole('link', { name: 'Contacts' }).click();
    await expect(page).toHaveURL(/\/contacts$/);
    await expect(drawer).toBeHidden();
    await expect(page.getByTestId('contacts-list')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(consoleErrors).toEqual([]);
  });

  test('pipeline board scrolls horizontally inside its container only', async ({ page }) => {
    await openApp(page, '/pipeline');
    await expect(page.getByTestId('pipeline-column').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const scrollable = await page.getByTestId('pipeline-board').evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(scrollable).toBe(true);
  });

  test('renders Arabic RTL correctly on mobile', async ({ page }) => {
    await openApp(page, '/dashboard');
    await switchLanguage(page, 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('نظرة عامة على المبيعات');
    await expectNoHorizontalOverflow(page);

    await page.getByTestId('mobile-menu').click();
    const drawer = page.getByTestId('mobile-nav');
    await expect(drawer).toBeVisible();
    // Drawer slides in from the right edge in RTL.
    const box = (await drawer.boundingBox())!;
    expect(box.x + box.width).toBeGreaterThan(380);
    await drawer.getByRole('link', { name: 'جهات الاتصال' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('جهات الاتصال');
    await expectNoHorizontalOverflow(page);
  });

  test('French layout fits the mobile viewport', async ({ page }) => {
    await openApp(page, '/activities');
    await switchLanguage(page, 'fr');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tâches et activités');
    await expectNoHorizontalOverflow(page);
  });
});
