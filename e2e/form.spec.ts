import { test, expect } from '@playwright/test';

const TYPED = [
  'Pizza',
  'Sushi',
  'Tacos',
  'Ramen',
  'Curry',
  'Salad',
  'Burger',
  'Pasta',
];

test('reload wipes every input', async ({ page }) => {
  await page.goto('/');

  for (let n = 1; n <= 8; n += 1) {
    await page.fill(`#opt-${n}`, TYPED[n - 1]);
  }
  for (let n = 1; n <= 8; n += 1) {
    await expect(page.locator(`#opt-${n}`)).toHaveValue(TYPED[n - 1]);
  }

  await page.reload();

  for (let n = 1; n <= 8; n += 1) {
    await expect(page.locator(`#opt-${n}`)).toHaveValue('');
  }
});
