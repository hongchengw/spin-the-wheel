import { test, expect } from '@playwright/test';

// Both names are deliberately innocuous: the tab title is the first thing a
// user sees, and it must not hint at the joke.
test('serves the app shell with its title heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Normal Spin The Wheel');
  await expect(page).toHaveTitle('Normal Spin The Wheel');
});
