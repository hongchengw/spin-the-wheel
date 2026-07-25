import { test, expect } from '@playwright/test';

test('serves the app shell with its title heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Infinite Spin Trap');
});
