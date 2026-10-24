import { expect, openApp, pickOption, test } from './fixtures';

test.describe('Form controls showcase', () => {
  test('is reachable from Settings and validates a Signal Form built from Orbit controls', async ({ page, consoleErrors }) => {
    await openApp(page, '/settings');
    await page.getByTestId('showcase-link').click();
    await expect(page).toHaveURL(/\/showcase$/);

    const form = page.getByTestId('showcase-form');
    await page.getByTestId('sc-submit').click();
    await expect(page.getByTestId('sc-result')).toHaveText(/fields need attention/);
    await expect(form.locator('#sc-name-error')).toHaveText('This field is required');
    await expect(page.getByTestId('sc-name')).toHaveAttribute('aria-invalid', 'true');

    await page.getByTestId('sc-name').fill('Nadia Karim');
    await page.getByTestId('sc-email').fill('nadia@example.org');
    await page.getByTestId('sc-password').fill('correct-horse');
    await pickOption(page, 'sc-plan', 'Growth');
    await page.getByTestId('sc-company').fill('north');
    await page.getByTestId('sc-company').press('ArrowDown');
    await page.getByTestId('sc-company').press('Enter');
    await expect(page.getByTestId('sc-company')).toHaveValue(/North/);
    await page.getByTestId('sc-budget').fill('48,500');
    await page.getByTestId('sc-terms').check();
    await page.getByTestId('sc-submit').click();

    await expect(page.getByTestId('sc-result')).toHaveText('All fields are valid.');
    await expect(page.getByTestId('toast').filter({ hasText: 'Nadia Karim' })).toBeVisible();
    await expect(page.getByTestId('sc-value')).toContainText('"budget": 48500');
    expect(consoleErrors).toEqual([]);
  });
});
