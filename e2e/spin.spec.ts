import { test, expect, type Page } from '@playwright/test';
import { TYPED, fillOptions } from './helpers';

/**
 * The animation is only real in a real browser — jsdom runs none of it. This
 * file is where "the wheel actually spins, forever, without a seam" is proven.
 */

/** Must stay in sync with `.wheel.is-spinning` in src/style.css. */
const SPIN_PERIOD_S = 0.125;
/** 360deg / 0.125s = 2880 — also the terminal velocity of the spin-up easing. */
const TERMINAL_DEG_PER_S = 360 / SPIN_PERIOD_S;
/** `.wheel.is-spinning-up` duration; the handoff happens at this mark. */
const SPIN_UP_MS = 6000;
/** Comfortably past the handoff, for tests that assert on stage 2. */
const PAST_HANDOFF_MS = SPIN_UP_MS + 600;

async function fillAndSpin(page: Page): Promise<void> {
  await page.goto('/');
  await fillOptions(page, TYPED);
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

  // 3s is inside the 6s wind-up now, not past it. That still satisfies the
  // claim — the wheel is turning at ~490deg/s there — and the point of the
  // test is that motion spans the whole window, not that stage 2 has begun.
  // `never settles — still moving at 10 seconds` is what covers stage 2 alone.
  await page.waitForTimeout(3000);
  const early = await wheelTransform(page);

  await page.waitForTimeout(5000);
  const late = await wheelTransform(page);

  // A third sample offset by a non-multiple of the spin period, so that a
  // coincidental match between the first two cannot read as "stopped". The
  // period is only 125ms now, so the offset has to stay well clear of a whole
  // turn: 60ms is ~173deg, about as far from a repeat as the wheel gets.
  await page.waitForTimeout(60);
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
    //
    // That unwrap puts a hard ceiling on WINDOW: a window that spans a full
    // turn or more aliases back down into [0, 360) and reports a velocity far
    // *lower* than the truth, which looks exactly like the lurch this test is
    // hunting for. At the sustained 2880deg/s the wheel covers 360deg in only
    // 125ms, i.e. about 7.5 frames — so the ceiling is genuinely close. Two
    // frames is ~33ms (~96deg) and stays under it even if a couple of frames
    // inside the window are dropped. Do not raise this to buy smoothness; the
    // 5-point median below is where smoothing belongs.
    const WINDOW = 2;
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

test('no frame stalls when stage 2 takes over', async ({ page }) => {
  await fillAndSpin(page);

  // The seam test above smooths its samples, which is what makes it robust to
  // timing jitter — and also what lets a one-frame stall through. Stage 1
  // finishes on 720deg but `animationend` only arrives on the next tick, so
  // stage 2 starting its own timeline from 0deg would repeat that frame and
  // drop a frame's worth of travel. Nothing here is smoothed: every frame must
  // move the wheel.
  const frames = await page.evaluate(async (recordMs: number) => {
    const el = document.querySelector('.wheel');
    if (!el) throw new Error('missing .wheel');

    const samples: { t: number; a: number; spinning: boolean }[] = [];
    // The document timeline is the clock the animation is sampled against;
    // performance.now() is a different clock and adds phase noise.
    const start = Number(document.timeline.currentTime);
    await new Promise<void>((resolve) => {
      const step = () => {
        const t = Number(document.timeline.currentTime) - start;
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        samples.push({
          t,
          a: (Math.atan2(m.b, m.a) * 180) / Math.PI,
          spinning: el.classList.contains('is-spinning'),
        });
        if (t > recordMs) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    return samples;
  }, SPIN_UP_MS + 1200);

  const swap = frames.findIndex((f) => f.spinning);
  expect(swap).toBeGreaterThan(0);

  // Every frame in a window around the handoff, both stages included — but
  // the window is asymmetric, and that is not a fudge.
  //
  // Stage 2 is flat, so any number of frames after the swap can be held to the
  // terminal velocity. Stage 1 is not: it is still accelerating hard right up
  // to the handoff, so a frame N frames *before* the swap is legitimately
  // slower than terminal, by a lot. At 60Hz the easing sits at ~0.91x terminal
  // 6 frames back, ~0.86x at 10, and ~0.75x at 20 — the last of which collides
  // with the floor asserted below and would fail for reasons that have nothing
  // to do with a stall. Six frames keeps every sampled stage-1 frame clear of
  // the floor while still covering the seam itself, which is the only place a
  // repeated frame can occur (the seam gap is measured at index `swap`).
  const from = Math.max(1, swap - 6);
  const to = Math.min(frames.length, swap + 20);

  const velocities: number[] = [];
  for (let i = from; i < to; i += 1) {
    const dt = frames[i].t - frames[i - 1].t;
    // Skip genuinely dropped frames; a stall keeps a normal dt but no travel.
    if (dt < 8 || dt > 25) continue;
    let advanced = (frames[i].a - frames[i - 1].a) % 360;
    if (advanced < 0) advanced += 360;
    velocities.push((advanced / dt) * 1000);
  }

  expect(velocities.length).toBeGreaterThan(10);
  // Over the sampled window stage 1 is within ~10% of its 2880deg/s terminal
  // velocity and stage 2 holds it exactly, so no single frame anywhere near
  // the seam may fall far short. A repeated frame would read as ~0.
  expect(Math.min(...velocities)).toBeGreaterThan(TERMINAL_DEG_PER_S * 0.75);
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
