import { test, expect } from '@playwright/test';
import { TYPED, fillOptions } from './helpers';

test('reload wipes every input', async ({ page }) => {
  await page.goto('/');

  await fillOptions(page, TYPED);
  for (let n = 1; n <= TYPED.length; n += 1) {
    await expect(page.locator(`#opt-${n}`)).toHaveValue(TYPED[n - 1]);
  }

  await page.reload();

  // The added rows go with the typing: a reload restores the default count, so
  // only the opening rows survive, and those come back blank.
  await expect(page.locator('input[data-option]')).toHaveCount(2);
  await expect(page.locator('#opt-1')).toHaveValue('');
  await expect(page.locator('#opt-2')).toHaveValue('');
});

test('the form opens at two rows, with remove hidden at that floor', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.locator('input[data-option]')).toHaveCount(2);
  await expect(page.locator('#option-count')).toHaveText('2 of 12 options');

  // Two options is the minimum a wheel can be built from, so there is nothing
  // left to remove and the controls say so rather than sitting there disabled.
  await expect(page.locator('.field__remove')).toHaveCount(2);
  for (const remove of await page.locator('.field__remove').all()) {
    await expect(remove).toBeHidden();
  }
  await expect(page.locator('#add-option')).toBeVisible();
});

test('adding a row brings the remove controls back', async ({ page }) => {
  await page.goto('/');
  await page.click('#add-option');

  await expect(page.locator('input[data-option]')).toHaveCount(3);
  await expect(page.locator('#option-count')).toHaveText('3 of 12 options');
  for (const remove of await page.locator('.field__remove').all()) {
    await expect(remove).not.toBeHidden();
  }
});

test('the add control disappears at the twelve option ceiling', async ({
  page,
}) => {
  await page.goto('/');
  for (let n = 3; n <= 12; n += 1) {
    await page.click('#add-option');
    await page.waitForSelector(`#opt-${n}`);
  }

  await expect(page.locator('input[data-option]')).toHaveCount(12);
  await expect(page.locator('#option-count')).toHaveText('12 of 12 options');
  await expect(page.locator('#add-option')).toBeHidden();
});
