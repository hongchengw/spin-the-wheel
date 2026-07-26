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

/** Centre of the button right now, in viewport coordinates. */
function buttonCentre(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const el = document.querySelector('#stop-btn');
    if (!el) throw new Error('missing #stop-btn');
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
}

test('the stop button dodges the cursor', async ({ page }) => {
  await fillAndSpin(page);
  await page.waitForTimeout(PAST_HANDOFF_MS);

  const before = await buttonCentre(page);
  await page.mouse.move(before.x, before.y, { steps: 10 });
  await page.waitForTimeout(400); // let the glide settle

  const after = await buttonCentre(page);
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(20);
});

/**
 * The dodge's one hard constraint. An earlier version measured the button's
 * live client rect to work out where it would sit untransformed, but that rect
 * lags during the 240ms glide, so the clamp was computed against a stale origin
 * and the button walked straight off the bottom of the window — taking the
 * taunt with it and growing a scrollbar on the way.
 */
test('the dodging button stays on screen and never grows the page', async ({
  page,
}) => {
  await fillAndSpin(page);
  await page.waitForTimeout(PAST_HANDOFF_MS);

  for (let i = 0; i < 10; i += 1) {
    const centre = await buttonCentre(page);
    await page.mouse.move(centre.x, centre.y, { steps: 6 });
    await page.waitForTimeout(320);

    const state = await page.evaluate(() => {
      const el = document.querySelector('#stop-btn');
      if (!el) throw new Error('missing #stop-btn');
      const r = el.getBoundingClientRect();
      const doc = document.documentElement;
      return {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        vw: window.innerWidth,
        vh: window.innerHeight,
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        scrollHeight: doc.scrollHeight,
        clientHeight: doc.clientHeight,
      };
    });

    expect(state.left).toBeGreaterThanOrEqual(0);
    expect(state.top).toBeGreaterThanOrEqual(0);
    expect(state.right).toBeLessThanOrEqual(state.vw);
    expect(state.bottom).toBeLessThanOrEqual(state.vh);
    expect(state.scrollWidth).toBeLessThanOrEqual(state.clientWidth);
    expect(state.scrollHeight).toBeLessThanOrEqual(state.clientHeight);
  }
});

test('a dodging button is still catchable, and still does nothing', async ({
  page,
}) => {
  await fillAndSpin(page);
  await page.waitForTimeout(PAST_HANDOFF_MS);

  // Chase it into whatever corner it ends up in.
  for (let i = 0; i < 6; i += 1) {
    const centre = await buttonCentre(page);
    await page.mouse.move(centre.x, centre.y, { steps: 6 });
    await page.waitForTimeout(300);
  }

  const before = await wheelTransform(page);
  await page.click('#stop-btn');

  // Cornered, clicked, and as useless as ever.
  await expect(page.locator('#taunt')).toHaveText('Slowing down…');
  await page.waitForTimeout(200);
  expect(await wheelTransform(page)).not.toBe(before);
});
