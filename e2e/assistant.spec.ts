import { Page } from '@playwright/test';
import { expect, openApp, pickOption, switchLanguage, test } from './fixtures';

async function openAssistant(page: Page): Promise<void> {
  await page.getByTestId('assistant-toggle').click();
  await expect(page.getByTestId('assistant-panel')).toBeVisible();
  await expect(page.getByTestId('assistant-input')).toBeFocused();
}

async function ask(page: Page, text: string): Promise<void> {
  await page.getByTestId('assistant-input').fill(text);
  await page.getByTestId('assistant-input').press('Enter');
}

/** The newest surface in the conversation. */
const lastSurface = (page: Page) => page.getByTestId('assistant-surface').last();

test.describe('Interactive Demo Assistant', () => {
  test('is clearly labelled and runs the sales overview with live KPIs', async ({ page, consoleErrors }) => {
    await openApp(page, '/dashboard');
    // Same metric functions as the dashboard, so the figures must match.
    const winRate = (await page.getByTestId('kpi-win-rate').locator('.sr-only').textContent())!.trim();
    const followUps = (await page.getByTestId('kpi-follow-ups').locator('.sr-only').textContent())!.trim();
    await openAssistant(page);
    await expect(page.getByTestId('assistant-label')).toContainText('no AI model');
    await expect(page.getByTestId('assistant-welcome')).toBeVisible();

    await page.locator('[data-testid="assistant-suggestion"][data-intent="salesOverview"]').click();
    await expect(page.getByTestId('a2ui-kpi-revenue')).toContainText('Total revenue');
    await expect(page.getByTestId('a2ui-kpi-revenue').locator('.sr-only')).toContainText('$');
    await expect(page.getByTestId('a2ui-kpi-win-rate').locator('.sr-only')).toHaveText(winRate);
    await expect(page.getByTestId('a2ui-kpi-follow-ups').locator('.sr-only')).toHaveText(followUps);
    await expect(lastSurface(page).getByTestId('a2ui-chart').locator('svg')).toBeVisible();
    await expect(page.getByTestId('assistant-message').last()).toContainText(/overdue|Nothing is overdue/);

    // Protocol inspector: the run streamed real AG-UI events, all schema-valid.
    await page.getByRole('tab', { name: /AG-UI events/ }).click();
    const run = page.getByTestId('inspector-run').first();
    await expect(run.getByTestId('inspector-run-status')).toHaveText('Finished');
    await expect(run.locator('[data-testid="inspector-event"][data-type="RUN_STARTED"]')).toHaveCount(1);
    await expect(run.locator('[data-testid="inspector-event"][data-type="ACTIVITY_SNAPSHOT"]')).toHaveCount(1);
    await expect(run.locator('[data-testid="inspector-event"][data-type="RUN_FINISHED"]')).toHaveCount(1);
    await expect(run.getByText('invalid', { exact: true })).toHaveCount(0);
    expect(consoleErrors).toEqual([]);
  });

  test('lists open deals from the store and reflects changes made in the pipeline', async ({ page, consoleErrors }) => {
    await openApp(page, '/pipeline');
    await openAssistant(page);
    await ask(page, 'top 3 deals');
    const list = lastSurface(page).getByTestId('a2ui-deal-list');
    await expect(list.getByTestId('a2ui-record')).toHaveCount(3);
    const biggest = (await list.getByTestId('a2ui-record-link').first().textContent())!.trim();

    // Close the deal elsewhere in the app, then refresh the assistant's list.
    await page.getByTestId('pipeline-search').fill(biggest);
    const card = page.getByTestId('deal-card').filter({ hasText: biggest });
    await card.getByTestId('deal-menu').click();
    await page.getByTestId('move-to-won').click();
    await expect(page.getByTestId('toast').filter({ hasText: 'marked as won' })).toBeVisible();

    await ask(page, 'top 3 deals');
    const refreshed = lastSurface(page).getByTestId('a2ui-deal-list');
    await expect(refreshed.getByTestId('a2ui-record')).toHaveCount(3);
    await expect(refreshed).not.toContainText(biggest);
    expect(consoleErrors).toEqual([]);
  });

  test('shows overdue tasks with links to their records', async ({ page, consoleErrors }) => {
    await openApp(page, '/dashboard');
    await openAssistant(page);
    await ask(page, 'What tasks are overdue?');
    const list = lastSurface(page).getByTestId('a2ui-overdue-list');
    await expect(list.getByTestId('a2ui-record').first()).toBeVisible();
    await expect(list.getByTestId('a2ui-record').first()).toContainText(/Due .* ago/);

    await list.getByTestId('a2ui-record-link').first().click();
    await expect(page).toHaveURL(/\/(contacts|deals)\/[a-z]{2}_/);
    // Docked on wide screens: the panel stays open while the page changes.
    await expect(page.getByTestId('assistant-panel')).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('rejects invalid follow-up input, then creates the task and updates the Tasks page', async ({ page, consoleErrors }) => {
    await openApp(page, '/dashboard');
    await openAssistant(page);
    await ask(page, 'Create a follow-up task');
    const form = page.getByTestId('followup-form');
    await expect(form).toBeVisible();

    await form.getByTestId('a2ui-form-submit').click();
    await expect(form.locator('.field-error').first()).toHaveText('Enter between 3 and 120 characters');
    await expect(form.locator('.field-error')).toContainText(['Link a contact or a deal']);
    await expect(page.getByTestId('assistant-message').last()).toContainText('2 fields need a fix');

    await form.getByTestId('followup-subject').fill('Send the Q3 renewal pricing');
    await form.getByTestId('followup-contact').fill('Nimbus');
    await expect(page.getByTestId('followup-contact-option').first()).toBeVisible();
    // The popup stays anchored to its input when the conversation scrolls.
    await page.locator('#assistant-panel-body').evaluate((el) => el.scrollBy(0, -60));
    await expect
      .poll(async () => {
        const input = (await form.getByTestId('followup-contact').boundingBox())!;
        const list = (await page.getByTestId('followup-contact-panel').boundingBox())!;
        return Math.min(Math.abs(list.y - (input.y + input.height)), Math.abs(input.y - (list.y + list.height)));
      })
      .toBeLessThan(8);
    await form.getByTestId('followup-contact').press('Enter');
    await form.getByTestId('a2ui-form-submit').click();

    await expect(page.getByTestId('a2ui-followup-created')).toContainText('Follow-up created');
    await expect(form.getByText('Submitted')).toBeVisible();
    await page.getByTestId('a2ui-open-tasks').click();
    await expect(page).toHaveURL(/\/activities$/);
    await expect(page.getByTestId('task-item').filter({ hasText: 'Send the Q3 renewal pricing' })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('moves a deal only after confirmation and can undo it', async ({ page, consoleErrors }) => {
    await openApp(page, '/dashboard');
    await openAssistant(page);
    await page.locator('[data-testid="assistant-suggestion"][data-intent="moveDealStage"]').click();
    const form = page.getByTestId('move-form');
    await form.getByTestId('move-deal').fill('Ironbridge Pilot');
    await form.getByTestId('move-deal').press('Enter');
    await pickOption(page, 'move-stage', 'Negotiation');
    await form.getByTestId('a2ui-form-submit').click();

    const confirmation = page.getByTestId('move-confirmation');
    await expect(confirmation).toContainText('Ironbridge Pilot Program');
    await expect(confirmation).toContainText('Negotiation');
    await confirmation.getByTestId('a2ui-confirm').click();
    await expect(page.getByTestId('a2ui-move-result')).toHaveText('Stage updated');

    await page.getByTestId('a2ui-undo-move').click();
    await expect(page.getByTestId('a2ui-move-result')).toHaveText('Change undone');
    await expect(page.getByTestId('a2ui-undo-move')).toBeDisabled();
    expect(consoleErrors).toEqual([]);
  });

  test('answers honestly when it does not understand, and blocks malformed UI payloads', async ({ page, consoleErrors }) => {
    await openApp(page, '/dashboard');
    await openAssistant(page);
    await ask(page, 'Book me a flight to Rome');
    await expect(page.getByTestId('assistant-message').last()).toContainText("didn't recognise that request");

    await ask(page, 'simulate a malformed payload');
    const rejected = page.getByTestId('a2ui-rejected');
    await expect(rejected).toContainText('Response blocked');
    await rejected.getByText('Validation details').click();
    await expect(rejected).toContainText('Invalid discriminator value');

    await page.getByTestId('assistant-reset').click();
    await expect(page.getByTestId('assistant-welcome')).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('works in Arabic with a right-to-left panel', async ({ page, consoleErrors }) => {
    await openApp(page, '/dashboard');
    await switchLanguage(page, 'ar');
    await openAssistant(page);
    const panel = page.getByTestId('assistant-panel');
    expect((await panel.boundingBox())!.x).toBeLessThan(10);
    await expect(page.getByTestId('assistant-label')).toContainText('بلا نموذج ذكاء اصطناعي');

    await page.locator('[data-testid="assistant-suggestion"][data-intent="overdueTasks"]').click();
    await expect(page.getByTestId('assistant-message').first()).toHaveText('ما المهام المتأخرة؟');
    await expect(lastSurface(page)).toContainText('متأخرة');
    await expect(lastSurface(page).getByTestId('a2ui-record').first()).toContainText('الاستحقاق');

    await switchLanguage(page, 'en');
    await expect(lastSurface(page)).toContainText('overdue');
    await expect(page.getByTestId('assistant-message').nth(1)).toHaveText('Let me check for overdue follow-ups.');
    expect(consoleErrors).toEqual([]);
  });
});
