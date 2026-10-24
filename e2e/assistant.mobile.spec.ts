import { expect, openApp, test } from './fixtures';

test.describe('Assistant on mobile', () => {
  test('opens as an accessible full-screen dialog and closes with Escape', async ({ page, consoleErrors }) => {
    await openApp(page, '/dashboard');
    const toggle = page.getByTestId('assistant-toggle');
    await toggle.click();
    const panel = page.getByTestId('assistant-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('role', 'dialog');
    await expect(panel).toHaveAttribute('aria-modal', 'true');
    const box = (await panel.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 1);
    await expect(page.getByTestId('assistant-input')).toBeFocused();

    await page.locator('[data-testid="assistant-suggestion"][data-intent="topDeals"]').click();
    await expect(page.getByTestId('a2ui-deal-list').getByTestId('a2ui-record').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(toggle).toBeFocused();

    // The conversation survives closing.
    await toggle.click();
    await expect(page.getByTestId('a2ui-deal-list')).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('closes after following a record link so the page is visible', async ({ page, consoleErrors }) => {
    await openApp(page, '/dashboard');
    await page.getByTestId('assistant-toggle').click();
    await page.locator('[data-testid="assistant-suggestion"][data-intent="topDeals"]').click();
    await page.getByTestId('a2ui-deal-list').getByTestId('a2ui-record-link').first().click();
    await expect(page).toHaveURL(/\/deals\/dl_/);
    await expect(page.getByTestId('assistant-panel')).toBeHidden();
    await expect(page.getByTestId('deal-title')).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});
