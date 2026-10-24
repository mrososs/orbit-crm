import en from '../public/i18n/en.json';
import { dragAndDrop, expect, openApp, parseNumber, switchLanguage, test, pickOption } from './fixtures';

/** Distinctive English UI strings that must never appear in Arabic or French views. */
const ENGLISH_PROBES = [
  en.dashboard.title,
  en.kpi.totalRevenue,
  en.kpi.winRate,
  en.nav.dashboard,
  en.nav.companies,
  en.dashboard.revenueTitle,
  en.dashboard.feedTitle,
  en.quickCreate.deal,
  en.common.clearFilters,
  en.charts.thisPeriod,
];

test.describe('Internationalisation', () => {
  test('loads English by default', async ({ page }) => {
    await openApp(page, '/dashboard');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sales overview');
  });

  test('switches to Arabic RTL and back to French LTR without losing state', async ({ page, consoleErrors }) => {
    await openApp(page, '/pipeline');
    await pickOption(page, 'filter-priority', 'High');
    const filteredCount = await page.getByTestId('deal-card').count();

    await switchLanguage(page, 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('مسار المبيعات');
    // Filters and records survive the language switch.
    await expect(page.getByTestId('filter-priority')).toHaveAttribute('data-value', 'high');
    await expect(page.getByTestId('deal-card')).toHaveCount(filteredCount);

    // The sidebar moves to the right edge in RTL.
    const sidebar = page.locator('aside').first();
    const box = (await sidebar.boundingBox())!;
    expect(box.x).toBeGreaterThan(1440 / 2);

    await switchLanguage(page, 'fr');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pipeline commercial');
    expect((await sidebar.boundingBox())!.x).toBe(0);
    expect(consoleErrors).toEqual([]);
  });

  test('persists the language after reload and through a demo reset', async ({ page }) => {
    await openApp(page, '/settings');
    await page.getByTestId('settings-language-ar').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('الإعدادات');

    await page.getByTestId('reset-data').click();
    await page.getByTestId('confirm-button').click();
    await expect(page.getByTestId('toast')).toContainText('تمت استعادة البيانات التجريبية');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  });

  test('translates chart labels and navigation in every language', async ({ page }) => {
    await openApp(page, '/dashboard');
    await expect(page.getByTestId('chart-pipeline').locator('svg')).toContainText('Negotiation');

    await switchLanguage(page, 'ar');
    await expect(page.getByTestId('chart-pipeline').locator('svg')).toContainText('تفاوض');
    await page.getByRole('link', { name: 'التقارير' }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('التقارير والتحليلات');

    await switchLanguage(page, 'fr');
    await page.getByRole('link', { name: 'Tableau de bord' }).first().click();
    await expect(page.getByTestId('chart-pipeline').locator('svg')).toContainText('Négociation');
  });

  test('shows no untranslated English UI strings in Arabic and French', async ({ page }) => {
    for (const lang of ['ar', 'fr'] as const) {
      await openApp(page, '/dashboard');
      await switchLanguage(page, lang);
      await openApp(page, '/dashboard');
      const text = await page.locator('body').innerText();
      for (const probe of ENGLISH_PROBES) expect(text, `${lang}: "${probe}"`).not.toContain(probe);
      expect(text).not.toMatch(/\b(dashboard|kpi|charts|pipeline)\.[a-z]/i); // raw keys
    }
  });

  test('dialogs, validation and toasts use the active language', async ({ page }) => {
    await openApp(page, '/contacts');
    await switchLanguage(page, 'fr');
    await page.getByTestId('new-contact').click();
    await expect(page.getByRole('heading', { name: 'Nouveau contact' })).toBeVisible();
    await page.getByTestId('contact-submit').click();
    await expect(page.locator('.field-error').first()).toContainText('Ce champ est obligatoire');

    await page.keyboard.press('Escape');
    await switchLanguage(page, 'ar');
    await page.getByTestId('new-contact').click();
    await page.getByTestId('contact-first-name').fill('ليلى');
    await page.getByTestId('contact-last-name').fill('حداد');
    await page.getByTestId('contact-email').fill('layla.haddad@example.org');
    await page.getByTestId('contact-submit').click();
    await expect(page.getByTestId('toast')).toContainText('تم إنشاء جهة الاتصال');
  });

  test('an open toast re-translates its parameters after a language switch', async ({ page }) => {
    await openApp(page, '/pipeline');
    const card = page.locator('[data-testid="pipeline-column"][data-stage="new"]').getByTestId('deal-card').first();
    await card.getByTestId('deal-menu').click();
    await page.getByTestId('move-to-qualified').click();
    await expect(page.getByTestId('toast')).toContainText('moved to Qualified');
    await switchLanguage(page, 'ar');
    await expect(page.getByTestId('toast')).toContainText('مؤهَّلة');
  });

  test('drag and drop works in the RTL Kanban board', async ({ page }) => {
    await openApp(page, '/pipeline');
    await switchLanguage(page, 'ar');
    const fromColumn = page.locator('[data-testid="pipeline-column"][data-stage="new"]');
    const toColumn = page.locator('[data-testid="pipeline-column"][data-stage="qualified"]');
    // In RTL the first stage sits to the right of the second.
    expect((await fromColumn.boundingBox())!.x).toBeGreaterThan((await toColumn.boundingBox())!.x);

    const before = parseNumber(await toColumn.getByTestId('column-count').textContent());
    const card = fromColumn.getByTestId('deal-card').first();
    const name = (await card.getByTestId('deal-card-link').textContent())!.trim();
    await dragAndDrop(page, card, toColumn.locator('.drop-list'));
    await expect(toColumn.getByTestId('column-count')).toHaveText(String(before + 1));
    await expect(toColumn.getByText(name)).toBeVisible();
  });

  test('language switching does not change monetary values', async ({ page }) => {
    await openApp(page, '/dashboard');
    const en = parseNumber(await page.getByTestId('kpi-revenue').locator('.sr-only').textContent());
    await switchLanguage(page, 'fr');
    const fr = parseNumber(await page.getByTestId('kpi-revenue').locator('.sr-only').textContent());
    await switchLanguage(page, 'ar');
    const ar = parseNumber(await page.getByTestId('kpi-revenue').locator('.sr-only').textContent());
    expect(fr).toBe(en);
    expect(ar).toBe(en);
    await expect(page.getByTestId('kpi-revenue')).toContainText('US$');
  });
});
