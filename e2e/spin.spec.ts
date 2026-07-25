import { test, expect, type Page } from '@playwright/test';

/**
 * The animation is only real in a real browser — jsdom runs none of it. This
 * file is where "the wheel actually spins, forever, without a seam" is proven.
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

/** Must stay in sync with `.wheel.is-spinning` in src/style.css. */
const SPIN_PERIOD_S = 0.9;
/** 360deg / 0.9s — also the terminal velocity of the spin-up easing. */
const TERMINAL_DEG_PER_S = 360 / SPIN_PERIOD_S;
/** `.wheel.is-spinning-up` duration; the handoff happens at this mark. */
const SPIN_UP_MS = 2000;
/** Comfortably past the handoff, for tests that assert on stage 2. */
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

test('the spin animation loops infinitely after the handoff', async ({
  page,
}) => {
  await fillAndSpin(page);
  await page.waitForTimeout(PAST_HANDOFF_MS);

  const iterations = await page.evaluate(() => {
    const el = document.querySelector('.wheel');
    if (!el) throw new Error('missing .wheel');
    return getComputedStyle(el).animationIterationCount;
  });

  expect(iterations).toBe('infinite');
});

test('the animation is running, never paused', async ({ page }) => {
  await fillAndSpin(page);
  await page.waitForTimeout(PAST_HANDOFF_MS);

  const playState = await page.evaluate(() => {
    const el = document.querySelector('.wheel');
    if (!el) throw new Error('missing .wheel');
    return getComputedStyle(el).animationPlayState;
  });

  expect(playState).toBe('running');
});

test('still rotating between 3s and 8s', async ({ page }) => {
  await fillAndSpin(page);

  await page.waitForTimeout(3000);
  const early = await wheelTransform(page);

  await page.waitForTimeout(5000);
  const late = await wheelTransform(page);

  // A third sample offset by a non-multiple of the spin period, so that a
  // coincidental match between the first two cannot read as "stopped".
  await page.waitForTimeout(130);
  const later = await wheelTransform(page);

  expect(new Set([early, late, later]).size).toBeGreaterThan(1);
});

test('never settles — still moving at 10 seconds', async ({ page }) => {
  await fillAndSpin(page);
  await page.waitForTimeout(10_000);

  const first = await wheelTransform(page);
  await page.waitForTimeout(200);
  const second = await wheelTransform(page);

  expect(second).not.toBe(first);
});

test('the pointer is outside .wheel and does not rotate with it', async ({
  page,
}) => {
  await fillAndSpin(page);

  const isDescendant = await page.evaluate(() => {
    const wheel = document.querySelector('.wheel');
    const pointer = document.querySelector('.pointer');
    if (!wheel || !pointer) throw new Error('missing .wheel or .pointer');
    return wheel.contains(pointer);
  });

  expect(isDescendant).toBe(false);
});

test('the stage-1 to stage-2 seam has no velocity lurch', async ({ page }) => {
  await fillAndSpin(page);

  // Record the rotation angle every frame across the handoff, then look for a
  // sudden drop in angular velocity. A stage 2 slower than stage 1's terminal
  // velocity shows up here as a cliff at the SPIN_UP_MS mark.
  const result = await page.evaluate(async (recordMs: number) => {
    const el = document.querySelector('.wheel');
    if (!el) throw new Error('missing .wheel');

    const angleOf = (): number => {
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      return (Math.atan2(m.b, m.a) * 180) / Math.PI;
    };

    const samples: { t: number; a: number }[] = [];
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const step = (now: number) => {
        samples.push({ t: now, a: angleOf() });
        if (now - start > recordMs) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

    // Windowed angular velocity. Rotation is always forward, so unwrap each
    // gap into [0, 360) rather than the usual +/-180 unwrap.
    const WINDOW = 5;
    const velocities: number[] = [];
    for (let i = WINDOW; i < samples.length; i += WINDOW) {
      const a = samples[i - WINDOW];
      const b = samples[i];
      let delta = (b.a - a.a) % 360;
      if (delta < 0) delta += 360;
      const dt = (b.t - a.t) / 1000;
      if (dt > 0) velocities.push(delta / dt);
    }

    // getComputedStyle reads the animation at the last style recalc, which
    // does not land exactly on the rAF timestamp, so individual windows carry
    // a little jitter. A 5-point median keeps a real cliff (which persists
    // across many windows) while dropping single-sample noise.
    const median = (xs: number[]): number =>
      [...xs].sort((p, q) => p - q)[Math.floor(xs.length / 2)];
    const smoothed: number[] = [];
    for (let i = 2; i < velocities.length - 2; i += 1) {
      smoothed.push(median(velocities.slice(i - 2, i + 3)));
    }

    const peak = Math.max(...smoothed);
    let worstDrop = 0;
    for (let i = 1; i < smoothed.length; i += 1) {
      worstDrop = Math.max(worstDrop, smoothed[i - 1] - smoothed[i]);
    }

    const tail = smoothed.slice(-4);
    const finalVelocity = tail.reduce((s, v) => s + v, 0) / tail.length;

    return { peak, worstDrop, finalVelocity, count: smoothed.length };
  }, SPIN_UP_MS + 1400);

  expect(result.count).toBeGreaterThan(8);

  // Stage 2 must run at the speed stage 1 finished at.
  expect(result.finalVelocity).toBeGreaterThan(TERMINAL_DEG_PER_S * 0.9);
  expect(result.finalVelocity).toBeLessThan(TERMINAL_DEG_PER_S * 1.1);

  // No window-to-window slowdown beyond frame-timing noise.
  expect(result.worstDrop).toBeLessThan(TERMINAL_DEG_PER_S * 0.15);
});

test('no dialog blocks navigation away from the spinning wheel', async ({
  page,
}) => {
  let dialogFired = false;
  page.on('dialog', async (dialog) => {
    dialogFired = true;
    await dialog.dismiss();
  });

  await fillAndSpin(page);
  await expect(page.locator('#wheel svg')).toBeVisible();
  await page.waitForTimeout(PAST_HANDOFF_MS);

  await page.reload();
  await expect(page.locator('#opt-1')).toBeVisible();

  expect(dialogFired).toBe(false);
});
