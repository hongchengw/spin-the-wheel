import { test, expect, type Page } from '@playwright/test';

/**
 * The stop button is the joke. These tests prove it stays a joke: it reacts
 * convincingly to every click and does precisely nothing to the wheel.
 */

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

/** `.wheel.is-spinning-up` duration; the handoff happens at this mark. */
const SPIN_UP_MS = 2000;
/** Comfortably past the handoff, matching e2e/spin.spec.ts. */
const PAST_HANDOFF_MS = SPIN_UP_MS + 600;

async function fillAndSpin(page: Page): Promise<void> {
  await page.goto('/');
  for (let n = 1; n <= 8; n += 1) {
    await page.fill(`#opt-${n}`, TYPED[n - 1]);
  }
  await page.click('#spin-btn');
}

function wheelTransform(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.querySelector('.wheel');
    if (!el) throw new Error('missing .wheel');
    return getComputedStyle(el).transform;
  });
}

async function clickStop(page: Page, times: number): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await page.click('#stop-btn');
  }
}

test('clicking STOP does not stop the wheel', async ({ page }) => {
  await fillAndSpin(page);
  await page.waitForTimeout(PAST_HANDOFF_MS);

  await clickStop(page, 5);
  await page.waitForTimeout(2000);

  const first = await wheelTransform(page);
  await page.waitForTimeout(200);
  const second = await wheelTransform(page);

  expect(second).not.toBe(first);
});

test('the wheel animation is still running after clicking STOP', async ({
  page,
}) => {
  await fillAndSpin(page);
  await page.waitForTimeout(PAST_HANDOFF_MS);
  await clickStop(page, 5);

  const state = await page.evaluate(() => {
    const el = document.querySelector('.wheel');
    if (!el) throw new Error('missing .wheel');
    const style = getComputedStyle(el);
    return {
      playState: style.animationPlayState,
      iterations: style.animationIterationCount,
      name: style.animationName,
    };
  });

  expect(state.playState).toBe('running');
  expect(state.iterations).toBe('infinite');
  expect(state.name).not.toBe('none');
});

test('the shake animation replays on a second click', async ({ page }) => {
  await fillAndSpin(page);
  await page.waitForTimeout(PAST_HANDOFF_MS);

  await page.evaluate(() => {
    const btn = document.querySelector('#stop-btn');
    if (!btn) throw new Error('missing #stop-btn');
    const w = window as unknown as { __shakes: number };
    w.__shakes = 0;
    btn.addEventListener('animationstart', () => {
      w.__shakes += 1;
    });
  });

  const shakeCount = (): Promise<number> =>
    page.evaluate(() => (window as unknown as { __shakes: number }).__shakes);

  await page.click('#stop-btn');
  await expect.poll(shakeCount).toBe(1);

  // Wait out the first animation so a replay is unambiguous.
  await page.waitForTimeout(500);

  await page.click('#stop-btn');
  await expect.poll(shakeCount).toBe(2);
});

test('the taunt text is visible and escalates to No.', async ({ page }) => {
  await fillAndSpin(page);
  await page.waitForTimeout(PAST_HANDOFF_MS);

  const taunt = page.locator('#taunt');
  const button = page.locator('#stop-btn');

  await expect(button).toBeVisible();
  await expect(button).toHaveText('STOP THE WHEEL');
  await expect(taunt).toHaveText('');

  await page.click('#stop-btn');
  await expect(taunt).toBeVisible();
  await expect(taunt).toHaveText('Slowing down…');

  await page.click('#stop-btn');
  await expect(taunt).toHaveText('Almost there…');

  await clickStop(page, 4);
  await expect(taunt).toHaveText('No.');

  await clickStop(page, 4);
  await expect(taunt).toHaveText('No.');

  // Still inviting, still lying.
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await expect(button).toHaveText('STOP THE WHEEL');
});
