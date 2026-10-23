import { dragAndDrop, expect, openApp, parseNumber, test } from './fixtures';

test.describe('Dashboard & pipeline', () => {
  test('opens the dashboard with KPIs and rendered charts', async ({ page, consoleErrors }) => {
    await openApp(page, '/');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Sales overview' })).toBeVisible();
    await expect(page.getByTestId('kpi-revenue')).toContainText('$');
    for (const id of ['chart-revenue', 'chart-pipeline', 'chart-won', 'chart-sources']) {
      await expect(page.getByTestId(id).locator('svg').first()).toBeVisible();
    }
    await expect(page.getByTestId('activity-feed').locator('li').first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('moving a deal to Won by drag and drop updates the board and dashboard metrics', async ({ page, consoleErrors }) => {
    await openApp(page, '/dashboard');
    const revenueBefore = parseNumber(await page.getByTestId('kpi-revenue').locator('.sr-only').textContent());

    await page.getByRole('link', { name: 'Pipeline' }).first().click();
    await expect(page).toHaveURL(/\/pipeline$/);
    await expect(page.getByTestId('pipeline-board')).toBeVisible();

    const negotiation = page.locator('[data-testid="pipeline-column"][data-stage="negotiation"]');
    const won = page.locator('[data-testid="pipeline-column"][data-stage="won"]');
    const wonCountBefore = parseNumber(await won.getByTestId('column-count').textContent());

    const card = negotiation.getByTestId('deal-card').first();
    const dealName = (await card.getByTestId('deal-card-link').textContent())!.trim();
    const dealValue = parseNumber(await card.locator('.tabular').first().textContent());

    await dragAndDrop(page, card, won.locator('.drop-list'));

    await expect(won.getByTestId('column-count')).toHaveText(String(wonCountBefore + 1));
    await expect(won.getByText(dealName)).toBeVisible();
    await expect(page.getByTestId('toast').filter({ hasText: 'marked as won' })).toBeVisible();

    await page.getByRole('link', { name: 'Dashboard' }).first().click();
    await expect
      .poll(async () => parseNumber(await page.getByTestId('kpi-revenue').locator('.sr-only').textContent()))
      .toBe(revenueBefore + dealValue);
    await expect(page.getByTestId('activity-feed')).toContainText(dealName);
    expect(consoleErrors).toEqual([]);
  });

  test('moves a deal without dragging using the card menu (keyboard alternative)', async ({ page }) => {
    await openApp(page, '/pipeline');
    const qualified = page.locator('[data-testid="pipeline-column"][data-stage="qualified"]');
    const proposal = page.locator('[data-testid="pipeline-column"][data-stage="proposal"]');
    const before = parseNumber(await proposal.getByTestId('column-count').textContent());
    const card = qualified.getByTestId('deal-card').first();
    const name = (await card.getByTestId('deal-card-link').textContent())!.trim();

    await card.getByTestId('deal-menu').focus();
    await page.keyboard.press('Enter');
    await page.getByTestId('move-to-proposal').click();

    await expect(proposal.getByTestId('column-count')).toHaveText(String(before + 1));
    await expect(proposal.getByText(name)).toBeVisible();

    // Undo from the toast restores the original stage.
    await page.getByTestId('toast').getByRole('button', { name: 'Undo' }).click();
    await expect(qualified.getByText(name)).toBeVisible();
  });

  test('keeps active filters when navigating away and back', async ({ page }) => {
    await openApp(page, '/pipeline');
    await page.getByTestId('filter-priority').selectOption('high');
    await page.getByTestId('filter-stage').selectOption('proposal');
    await page.getByRole('link', { name: 'Contacts' }).first().click();
    await page.getByRole('link', { name: 'Pipeline' }).first().click();
    await expect(page.getByTestId('filter-priority')).toHaveValue('high');
    await expect(page.getByTestId('filter-stage')).toHaveValue('proposal');
    await expect(page.getByTestId('pipeline-column')).toHaveCount(1);
  });

  test('filters and searches the pipeline, then opens deal details', async ({ page }) => {
    await openApp(page, '/pipeline');
    await page.getByTestId('pipeline-search').fill('Cobalt');
    await expect(page.getByTestId('deal-card').first()).toContainText('Cobalt');
    await page.getByTestId('view-list').click();
    const rows = page.getByTestId('pipeline-table').locator('tbody tr');
    await expect(rows.first()).toContainText('Cobalt');
    await rows.first().click();
    await expect(page).toHaveURL(/\/deals\/dl_/);
    await expect(page.getByTestId('deal-title')).toContainText('Cobalt');
  });
});

test.describe('Contacts', () => {
  test('validates, creates and edits a contact', async ({ page, consoleErrors }) => {
    await openApp(page, '/contacts');
    await page.getByTestId('new-contact').click();
    await page.getByTestId('contact-submit').click();
    await expect(page.locator('.field-error').first()).toHaveText(/This field is required/);

    await page.getByTestId('contact-first-name').fill('Nadia');
    await page.getByTestId('contact-last-name').fill('Karim');
    await page.getByTestId('contact-email').fill('nadia.karim@example.org');
    await page.getByTestId('contact-phone').fill('+33 1 99 00 12 34');
    await page.getByTestId('contact-title').fill('Head of Revenue');
    await page.getByTestId('contact-company').selectOption({ label: 'Nimbus Software' });
    await page.getByTestId('contact-submit').click();
    await expect(page.getByTestId('toast').filter({ hasText: 'Contact created' })).toBeVisible();

    await page.getByTestId('contact-search').fill('Nadia Karim');
    const row = page.getByTestId('contact-row').filter({ hasText: 'Nadia Karim' });
    await expect(row).toBeVisible();
    await row.getByTestId('contact-name').click();
    await expect(page.getByTestId('contact-heading')).toHaveText('Nadia Karim');

    await page.getByTestId('edit-contact').click();
    await page.getByTestId('contact-title').fill('Chief Revenue Officer');
    await page.getByTestId('contact-status').selectOption('prospect');
    await page.getByTestId('contact-submit').click();
    await expect(page.getByText('Chief Revenue Officer at Nimbus Software')).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('Tasks', () => {
  test('creates and completes a task', async ({ page, consoleErrors }) => {
    await openApp(page, '/activities');
    await page.getByTestId('new-task').click();
    await page.getByTestId('activity-subject').fill('Prepare renewal proposal');
    await page.getByTestId('activity-submit').click();
    await expect(page.getByTestId('toast').filter({ hasText: 'Task created' })).toBeVisible();

    const task = page.getByTestId('task-item').filter({ hasText: 'Prepare renewal proposal' });
    await expect(task).toBeVisible();
    const completedBefore = parseNumber(await page.getByTestId('completed-week').textContent());
    await task.getByTestId('task-toggle').click();
    await expect(page.getByTestId('toast').filter({ hasText: 'Task completed' })).toBeVisible();
    await expect(page.getByTestId('task-item').filter({ hasText: 'Prepare renewal proposal' })).toHaveCount(0);
    await expect(page.getByTestId('completed-week')).toHaveText(String(completedBefore + 1));

    await page.getByRole('tab', { name: /Completed/ }).click();
    await expect(page.getByTestId('task-item').filter({ hasText: 'Prepare renewal proposal' })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('Persistence & demo controls', () => {
  test('keeps changes after reload and restores the dataset on reset', async ({ page }) => {
    await openApp(page, '/companies');
    await page.getByTestId('new-company').click();
    await page.getByTestId('company-name').fill('Orbitron Labs');
    await page.getByTestId('company-city').fill('Lisbon');
    await page.getByTestId('company-submit').click();
    await expect(page.getByTestId('toast').filter({ hasText: 'Company created' })).toBeVisible();

    await page.reload();
    await openApp(page, '/companies');
    await page.getByTestId('company-search').fill('Orbitron');
    await expect(page.getByTestId('company-row')).toHaveCount(1);

    await page.goto('/settings');
    await expect(page.getByTestId('count-companies')).toHaveText('31');
    await page.getByTestId('reset-data').click();
    await page.getByTestId('confirm-button').click();
    await expect(page.getByTestId('toast').filter({ hasText: 'Demo data restored' })).toBeVisible();
    await expect(page.getByTestId('count-companies')).toHaveText('30');

    await page.goto('/companies');
    await page.getByTestId('company-search').fill('Orbitron');
    await expect(page.getByText('No companies match your filters')).toBeVisible();
  });

  test('unknown routes show a not-found page', async ({ page }) => {
    await page.goto('/does-not-exist');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});
