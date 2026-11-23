import { test, expect } from '@playwright/test';
import { DISCLAIMER_ITALIC_LINES, DISCLAIMER_STORAGE_KEY, DISCLAIMER_TITLE } from '../src/lib/disclaimer';

test.describe('Disclaimer obbligatorio', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("blocca l'accesso finché non si accetta, poi non riappare", async ({ page }) => {
    await page.goto('/');

    const dialog = page.getByRole('dialog', { name: DISCLAIMER_TITLE });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('unica piattaforma ufficiale della lega')).toBeVisible();
    await expect(dialog.getByText(DISCLAIMER_ITALIC_LINES[0])).toBeVisible();
    await expect(dialog.getByText(DISCLAIMER_ITALIC_LINES[1])).toBeVisible();

    const enter = dialog.getByRole('button', { name: 'Entra' });
    await expect(enter).toBeDisabled();

    // ESC e click fuori non chiudono.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await page.locator('[data-disclaimer-root] > div[aria-hidden="true"]').click({ position: { x: 8, y: 8 }, force: true });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Ho letto e accetto').check();
    await expect(enter).toBeEnabled();
    await enter.click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Qual è la tua squadra?' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Note legali' })).toBeVisible();

    const stored = await page.evaluate((key) => localStorage.getItem(key), DISCLAIMER_STORAGE_KEY);
    expect(stored).toBeTruthy();

    await page.reload();
    await expect(page.getByRole('dialog', { name: DISCLAIMER_TITLE })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Qual è la tua squadra?' })).toBeVisible();
  });

  test("dopo un cambio di chiave l'accettazione viene chiesta di nuovo", async ({ page }) => {
    await page.goto('/');
    const dialog = page.getByRole('dialog', { name: DISCLAIMER_TITLE });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Ho letto e accetto').check();
    await dialog.getByRole('button', { name: 'Entra' }).click();
    await expect(dialog).toHaveCount(0);

    await page.evaluate((key: string) => {
      localStorage.removeItem(key);
      localStorage.setItem('fantalive_disclaimer_v0_old', new Date().toISOString());
    }, DISCLAIMER_STORAGE_KEY);
    await page.reload();
    await expect(page.getByRole('dialog', { name: DISCLAIMER_TITLE })).toBeVisible();
  });

  test('la pagina Note legali resta raggiungibile e /admin/login non è bloccato', async ({ page }) => {
    await page.goto('/disclaimer');
    await expect(page).toHaveURL('/disclaimer');
    const dialog = page.getByRole('dialog', { name: DISCLAIMER_TITLE });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Ho letto e accetto').check();
    await dialog.getByRole('button', { name: 'Entra' }).click();
    await expect(page).toHaveURL('/disclaimer');
    await expect(page.getByRole('heading', { name: DISCLAIMER_TITLE })).toBeVisible();
    await expect(page.getByText(DISCLAIMER_ITALIC_LINES[1])).toBeVisible();

    await page.goto('/admin/login');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entra' })).toBeVisible();
  });
});
