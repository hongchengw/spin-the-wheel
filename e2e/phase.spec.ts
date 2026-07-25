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

async function fillAndSpin(page: import('@playwright/test').Page) {
  await page.goto('/');
  for (let n = 1; n <= 8; n += 1) {
    await page.fill(`#opt-${n}`, TYPED[n - 1]);
  }
  await page.click('#spin-btn');
}

test('spinning shows the wheel with the typed labels', async ({ page }) => {
  await fillAndSpin(page);

  await expect(page.locator('#wheel svg')).toBeVisible();
  await expect(page.locator('#wheel svg text')).toHaveText(TYPED);
  await expect(page.locator('#setup-panel')).toHaveCount(0);
});

test('no inputs remain once spinning starts', async ({ page }) => {
  await fillAndSpin(page);

  await expect(page.locator('input')).toHaveCount(0);
});

test('leaving the page never raises a dialog', async ({ page }) => {
  let dialogFired = false;
  page.on('dialog', async (dialog) => {
    dialogFired = true;
    await dialog.dismiss();
  });

  await fillAndSpin(page);
  await expect(page.locator('#wheel svg')).toBeVisible();

  await page.reload();
  await expect(page.locator('#opt-1')).toBeVisible();

  await page.goBack();
  await page.waitForTimeout(500);

  expect(dialogFired).toBe(false);
});
