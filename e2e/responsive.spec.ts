import { test, expect, type Page } from '@playwright/test';

/**
 * Layout is only observable in a real browser, so every assertion here is a
 * measurement taken from a live render rather than a class-name check.
 *
 * Each test sets its own viewport explicitly. The Playwright config runs this
 * file under both the `chromium` and `mobile` projects, and a layout assertion
 * is only meaningful at a known width — so the width is pinned in the test
 * rather than inherited from the project.
 */

const MOBILE = { width: 375, height: 667 };
const DESKTOP = { width: 1280, height: 800 };

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

/** `.wheel.is-spinning-up` lasts 2s; wait past the handoff, as spin.spec does. */
const PAST_HANDOFF_MS = 2600;

async function fillAndSpin(page: Page): Promise<void> {
  for (let n = 1; n <= 8; n += 1) {
    await page.fill(`#opt-${n}`, TYPED[n - 1]);
  }
  await page.click('#spin-btn');
  await expect(page.locator('#wheel svg')).toBeVisible();
  // Measure the settled layout, after the spin-up/constant-spin handoff.
  await page.waitForTimeout(PAST_HANDOFF_MS);
}

function scrollMetrics(
  page: Page,
): Promise<{ scrollWidth: number; clientWidth: number; scrollHeight: number; clientHeight: number }> {
  return page.evaluate(() => {
    const el = document.documentElement;
    return {
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    };
  });
}

test('no horizontal scroll in the setup phase at 375x667', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/');
  await expect(page.locator('#opt-1')).toBeVisible();

  const m = await scrollMetrics(page);
  expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
});

test('no horizontal scroll in the spinning phase at 375x667', async ({
  page,
}) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/');
  await fillAndSpin(page);

  const m = await scrollMetrics(page);
  expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
});

test('no horizontal scroll at desktop width in either phase', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await expect(page.locator('#opt-1')).toBeVisible();

  const setup = await scrollMetrics(page);
  expect(setup.scrollWidth).toBeLessThanOrEqual(setup.clientWidth);

  await fillAndSpin(page);

  const spinning = await scrollMetrics(page);
  expect(spinning.scrollWidth).toBeLessThanOrEqual(spinning.clientWidth);
});

test('the spinning view fits one viewport at 375x667', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/');
  await fillAndSpin(page);

  const m = await scrollMetrics(page);
  // +1 absorbs sub-pixel rounding, nothing more.
  expect(m.scrollHeight).toBeLessThanOrEqual(m.clientHeight + 1);
});

test('the stop button is fully inside the viewport at 375x667', async ({
  page,
}) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/');
  await fillAndSpin(page);

  const box = await page.locator('#stop-btn').boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(MOBILE.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(MOBILE.height + 1);
});

test('the taunt line is inside the viewport at 375x667', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/');
  await fillAndSpin(page);

  const box = await page.locator('#taunt').boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(MOBILE.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(MOBILE.height + 1);
});

test('the wheel is rendered and not clipped horizontally at 375x667', async ({
  page,
}) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/');
  await fillAndSpin(page);

  // Measured from the layout box and the known art ratio, not from a client
  // rect. The wheel is mid-rotation, so a client rect reports the *swept*
  // bounding box — a square's diagonal, ~41% wider than the wheel itself. Those
  // swept corners are empty and are deliberately clipped away by .stage__clip,
  // so asserting on them would be asserting on nothing that is ever drawn.
  const art = await page.evaluate(() => {
    const wheel = document.querySelector<HTMLElement>('#wheel');
    if (!wheel) return null;
    const layout = wheel.offsetWidth;
    // Only the inscribed circle is painted: rim r=181 of a 400 viewBox.
    const diameter = layout * 0.905;
    const centre = wheel.getBoundingClientRect();
    return {
      layout,
      diameter,
      left: centre.left + centre.width / 2 - diameter / 2,
      top: centre.top + centre.height / 2 - diameter / 2,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });
  expect(art).not.toBeNull();
  if (!art) return;

  // Guards the cheap fix: shrinking the wheel until nothing can overflow.
  // It has to stay the hero of the screen, not a coin.
  expect(art.layout).toBeGreaterThan(MOBILE.width * 0.55);

  // Nothing painted may leave the viewport, in either axis...
  expect(art.left).toBeGreaterThanOrEqual(0);
  expect(art.left + art.diameter).toBeLessThanOrEqual(MOBILE.width + 1);
  expect(art.top).toBeGreaterThanOrEqual(0);
  expect(art.top + art.diameter).toBeLessThanOrEqual(MOBILE.height + 1);

  // ...and the clipped corners must not have widened the document either.
  expect(art.scrollWidth).toBeLessThanOrEqual(art.clientWidth);
});

test('inputs are a single column below 560px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/');

  const first = await page.locator('#opt-1').boundingBox();
  const second = await page.locator('#opt-2').boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  if (!first || !second) return;

  // Stacked: #opt-2 sits strictly below #opt-1, not beside it.
  expect(second.y).toBeGreaterThan(first.y + first.height / 2);
  // And each field spans the column, rather than sharing the row.
  expect(Math.abs(second.x - first.x)).toBeLessThan(2);
});

test('inputs are two columns at 900px wide', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto('/');

  const first = await page.locator('#opt-1').boundingBox();
  const second = await page.locator('#opt-2').boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  if (!first || !second) return;

  // Side by side: same row, different columns.
  expect(Math.abs(second.y - first.y)).toBeLessThan(2);
  expect(second.x).toBeGreaterThan(first.x + first.width / 2);
});
