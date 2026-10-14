import { test, expect } from '@playwright/test';

test.describe('Bottom Navigation', () => {
  test('all bottom nav items render content', async ({ page }) => {
    // Test Live (home) page
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(page.locator('nav').getByText('Live')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bundlesliga' })).toBeVisible();
    
    // Test Sfida page (may redirect to specific match)
    await page.locator('nav.fixed.bottom-0').first().getByRole('link', { name: 'Sfida' }).click();
    await page.waitForURL(/\/sfida/);
    // Page should have some content (not just loading)
    await expect(page.locator('main')).not.toBeEmpty();
    
    // Test Serie A (partite) page
    await page.locator('nav.fixed.bottom-0').first().getByRole('link', { name: 'Serie A' }).click();
    await page.waitForURL('/partite');
    await expect(page.locator('main')).not.toBeEmpty();
    
    // Test Classifica page
    await page.locator('nav.fixed.bottom-0').first().getByRole('link', { name: 'Classifica' }).click();
    await page.waitForURL('/classifica');
    await expect(page.getByRole('table')).toBeVisible();
    
    // Test Admin page (redirects to login)
    await page.locator('nav.fixed.bottom-0').first().getByRole('link', { name: 'Admin' }).click();
    await page.waitForURL('/admin/login');
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
  });

  test('classifica page renders standings table with data', async ({ page }) => {
    await page.goto('/classifica');
    
    // Wait for data to load (not just skeleton)
    await expect(page.getByRole('table')).toBeVisible();
    
    // Check that table has header columns
    await expect(page.getByRole('columnheader', { name: '#' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Squadra' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Pt' })).toBeVisible();
    
    // Check that table has data rows (at least one team)
    const rows = page.locator('table tbody tr');
    await expect(rows).not.toHaveCount(0);
  });

  test('each page has working bottom nav', async ({ page }) => {
    const pages = [
      { url: '/', navLabel: 'Live' },
      { url: '/sfida', navLabel: 'Sfida' },
      { url: '/partite', navLabel: 'Serie A' },
      { url: '/classifica', navLabel: 'Classifica' },
    ];

    for (const { url, navLabel } of pages) {
      await page.goto(url);
      
      // Bottom nav should be visible (use first if multiple due to loading states)
      const nav = page.locator('nav.fixed.bottom-0').first();
      await expect(nav).toBeVisible();
      
      // All nav items should be present
      await expect(nav.getByText('Live')).toBeVisible();
      await expect(nav.getByText('Sfida')).toBeVisible();
      await expect(nav.getByText('Serie A')).toBeVisible();
      await expect(nav.getByText('Classifica')).toBeVisible();
      await expect(nav.getByText('Admin')).toBeVisible();
      
      // Current page link should have active styling (check parent Link has emerald color)
      const activeLink = nav.locator(`a:has-text("${navLabel}")`);
      await expect(activeLink).toHaveClass(/text-emerald-600/);
    }
  });
});
