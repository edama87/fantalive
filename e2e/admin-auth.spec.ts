import { test, expect } from '@playwright/test';

test.describe('Admin Authentication', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('unauthenticated user accessing /admin is redirected to /admin/login with visible form', async ({ page }) => {
    await page.goto('/admin');
    
    await expect(page).toHaveURL('/admin/login');
    
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entra' })).toBeVisible();
  });

  test('login page shows password field and Entra button', async ({ page }) => {
    await page.goto('/admin/login');
    
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entra' })).toBeVisible();
    await expect(page.getByText('Inserisci la password per accedere al pannello admin')).toBeVisible();
  });

  test('wrong password shows error message', async ({ page }) => {
    await page.goto('/admin/login');
    
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Entra' }).click();
    
    await expect(page.getByText(/Invalid password|Errore/i)).toBeVisible();
    await expect(page).toHaveURL('/admin/login');
  });

  test('correct password redirects to /admin landing page', async ({ page }) => {
    await page.goto('/admin/login');
    
    await page.getByLabel('Password').fill('test');
    await page.getByRole('button', { name: 'Entra' }).click();
    
    await expect(page).toHaveURL('/admin');
    await expect(page.getByText('Pannello Amministrazione')).toBeVisible();
    await expect(page.getByRole('link', { name: /Mercato/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Formazioni/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Logout/ })).toBeVisible();
  });

  test('authenticated user can access /admin/mercato', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Password').fill('test');
    await page.getByRole('button', { name: 'Entra' }).click();
    await expect(page).toHaveURL('/admin');
    
    await page.goto('/admin/mercato');
    await expect(page).toHaveURL('/admin/mercato');
    await expect(page.getByText('Importazione Mercato')).toBeVisible();
  });

  test('authenticated user can access /admin/formazioni', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Password').fill('test');
    await page.getByRole('button', { name: 'Entra' }).click();
    await expect(page).toHaveURL('/admin');
    
    await page.goto('/admin/formazioni');
    await expect(page).toHaveURL('/admin/formazioni');
    await expect(page.getByText('Importazione Formazioni')).toBeVisible();
  });

  test('logout redirects to home and clears session', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Password').fill('test');
    await page.getByRole('button', { name: 'Entra' }).click();
    await expect(page).toHaveURL('/admin');
    
    await page.getByRole('button', { name: /Logout|Esci/ }).click();
    
    await expect(page).toHaveURL('/');
    
    await page.goto('/admin');
    await expect(page).toHaveURL('/admin/login');
  });

  test('admin landing page has working links to Mercato and Formazioni', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Password').fill('test');
    await page.getByRole('button', { name: 'Entra' }).click();
    await expect(page).toHaveURL('/admin');
    
    await page.getByRole('link', { name: /Mercato/ }).click();
    await expect(page).toHaveURL('/admin/mercato');
    
    await page.goto('/admin');
    await page.getByRole('link', { name: /Formazioni/ }).click();
    await expect(page).toHaveURL('/admin/formazioni');
  });
});
