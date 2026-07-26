import { type Page } from '@playwright/test';

/**
 * Shared setup for the specs that need a filled form.
 *
 * The form opens at two rows, but most specs want a wheel with enough slices to
 * be worth looking at — so every one of them would otherwise repeat the same
 * "click add N times, then fill" dance before it could get to its own subject.
 */

/** The default option words. Eight distinct, short, and easy to read on a slice. */
export const TYPED = [
  'Pizza',
  'Sushi',
  'Tacos',
  'Ramen',
  'Curry',
  'Salad',
  'Burger',
  'Pasta',
];

/** Mirrors MIN_OPTION_COUNT / MAX_OPTION_COUNT in src/form.ts. */
const MIN_ROWS = 2;
const MAX_ROWS = 12;

/**
 * Grows the option list to `values.length` rows, then types `values` into it.
 * Assumes the page is already on the setup phase.
 */
export async function fillOptions(page: Page, values: string[]): Promise<void> {
  if (values.length < MIN_ROWS || values.length > MAX_ROWS) {
    throw new Error(
      `fillOptions needs ${MIN_ROWS}-${MAX_ROWS} values, got ${values.length}`,
    );
  }

  // Add rows one at a time, waiting for each to land. The list is rebuilt from
  // scratch on every add, so clicking blind would race the re-render. The
  // starting count is read rather than assumed, so this stays correct if the
  // default moves again.
  const rows = page.locator('input[data-option]');
  for (let n = (await rows.count()) + 1; n <= values.length; n += 1) {
    await page.click('#add-option');
    await page.waitForSelector(`#opt-${n}`);
  }

  for (let n = 1; n <= values.length; n += 1) {
    await page.fill(`#opt-${n}`, values[n - 1]);
  }
}
