# Task 06 — Spin animation

## Your context

You are working on a web app called **Infinite Spin Trap**. This file is your complete context — you have not seen the project spec or any other task file, and you should not assume anything not written here.

Working directory: `C:\Users\hongc\OneDrive\Projects\spinthewheelahh\spin-the-wheel` (Windows).

## Prerequisite state

Previous tasks built the project skeleton, test harness, wheel geometry, setup form, and the setup→spinning phase switch. The repo has:

```
package.json        scripts: dev / build / preview / typecheck / test / test:watch / e2e
tsconfig.json       strict: true; includes src, tests, e2e
vite.config.ts      Vite + Vitest (environment: 'jsdom', include: ['tests/**/*.test.ts'])
playwright.config.ts   projects: 'chromium' (desktop) and 'mobile' (375x667); per-test timeout >= 30s
index.html          shell with <body class="setup">, #setup-panel, #spin-panel
src/main.ts         app wiring and the phase switch
src/form.ts         renderSetupPanel / readLabels / clearFields   — do not modify
src/wheel.ts        buildWheel(labels): SVGSVGElement             — do not modify
src/style.css       reset, theme custom properties, minimal stage layout
tests/*.test.ts     smoke, wheel, form, phase
e2e/*.spec.ts       smoke, form, phase
```

Current behavior: the user fills 8 inputs and clicks **Spin**. The setup panel is removed from the DOM, `<body>` switches from class `setup` to class `spinning`, and `#spin-panel` is populated with:

```html
<div class="stage">
  <div class="pointer" aria-hidden="true"></div>
  <div class="wheel" id="wheel"><svg viewBox="0 0 400 400">…8 labeled slices…</svg></div>
</div>
```

The wheel is currently **static**. That is what this task fixes.

## What the app does

This is a joke app. The wheel must spin up convincingly and then **never stop, never slow down, and never land on anything**. The user is meant to wait, get impatient, and eventually reload — at which point their typed options are gone.

The comedy depends entirely on the animation looking legitimate. A user who suspects a gag in the first five seconds never invests enough to be trapped. **Animation quality is a functional requirement here, not decoration.**

## Goal

Make `.wheel` spin up and then rotate forever at a constant rate.

## Spec

### What rotates

The **`.wheel` container `<div>`** rotates — not the `<svg>` and not any node inside it. Rotating an SVG element with CSS requires `transform-box` / `transform-origin` handling that differs across browsers; rotating a plain div does not. The `.pointer` lives outside `.wheel` and therefore stays still.

Add `will-change: transform;` to `.wheel`.

### Two-stage spin

```css
@keyframes spin-up { from { transform: rotate(0deg);    }
                     to   { transform: rotate(1440deg); } }
@keyframes spin    { from { transform: rotate(0deg);    }
                     to   { transform: rotate(360deg);  } }
```

- **Stage 1 — spin-up:** `animation: spin-up 1.5s cubic-bezier(.3, 0, .7, .4) forwards;` — four full turns, accelerating from rest.
- **Handoff:** JS listens for the `animationend` event on `.wheel` and swaps the class to start stage 2.
- **Stage 2 — spin:** `animation: spin .45s linear infinite;` — constant rate, forever.

Both stages begin and end at whole multiples of 360°, so the handoff is geometrically seamless.

Drive the two stages with classes on `.wheel` (for example `.wheel.is-spinning-up` and `.wheel.is-spinning`) so the CSS stays declarative and the JS only swaps class names.

### Tuning the seam — the part that matters

**The stage-2 duration must be tuned to match the terminal velocity of the stage-1 easing curve.** If stage 2 runs slower than the speed stage 1 finished at, the wheel visibly lurches at the 1.5s mark. That single moment is what would give the whole gag away.

`.45s` is a **starting value, not a fixed requirement**. Run the app, watch the 1.5s transition closely several times, and adjust the stage-2 duration until no seam is perceptible. Report what value you landed on and what you observed. If you change it, keep the CSS and any test that asserts on it in sync.

### Pointer tick

The `.pointer` gets a subtle wobble animation — roughly `0.45s`, looping, synced to slice passage (a slice passes the pointer every `duration / 8`, so consider that when choosing the tick period). A small rotation or translation of 2–4 degrees/pixels is enough. A perfectly still pointer over a spinning wheel reads as a broken render.

### Reduced motion

`prefers-reduced-motion` is **intentionally not honored for the wheel**. The spin is the app's entire function; a static wheel would be a blank screen with no explanation. Do **not** add a `@media (prefers-reduced-motion: reduce)` rule that stops or disables the wheel spin.

It **is** honored for incidental motion — if you add any non-essential transition in this task, disable that under reduced motion. The pointer tick may be disabled under reduced motion; the wheel rotation may not.

## Tests to write first

### `tests/spin.test.ts` (Vitest + jsdom)

jsdom does not run CSS animations, so unit tests here cover **class-swapping logic only** — not motion. Do not attempt to assert on computed animation state in jsdom; it will pass while the app is visibly broken.

Write these, run them, confirm they fail, then implement.

1. **After submit, `.wheel` carries the spin-up class.**
2. **Dispatching `animationend` on `.wheel` swaps it to the spinning class** and removes the spin-up class.
3. **The handoff is idempotent** — dispatching `animationend` a second time leaves the element in the spinning state (it must not toggle back or stack classes).
4. **No code path removes the spinning class.** Assert that after the handoff, `.wheel` still has the spinning class following an arbitrary later event (e.g. a `click` dispatched on `document.body`).

### `e2e/spin.spec.ts` (Playwright)

This is where the animation is actually verified. Fill the 8 inputs and click `#spin-btn` first in each test.

5. **`animation-iteration-count` is `infinite`** after the handoff. Wait past 1.5s, then read `getComputedStyle(el).animationIterationCount` on `.wheel` and assert it is `'infinite'`.
6. **Still rotating at ~8 seconds.** Sample `getComputedStyle(el).transform` at t≈3s and again at t≈8s and assert the two matrix strings **differ**. Guard against the coincidence of sampling at the same rotation angle: take three samples a non-multiple of the period apart and assert not all are equal.
7. **Never settles.** Sample the transform twice about 200ms apart at t≈10s and assert the values differ — a wheel that had stopped would report identical matrices.
8. **`animation-play-state` is `running`,** not `paused`.
9. **The pointer does not rotate with the wheel** — assert `.pointer` is not a descendant of `.wheel`.
10. **No dialog on navigation.** Register a `page.on('dialog', …)` handler that fails the test if fired, then `page.reload()`. Assert no dialog appeared. This locks in that no `beforeunload` handler exists.

For the timing-based tests, use `page.waitForTimeout` and remember the Playwright per-test timeout must accommodate a ~10s wait.

## Constraints

1. **The trap is social, not technical.** Never add `beforeunload`, history/back-button trapping, fullscreen or pointer lock, focus traps, or anything blocking browser shortcuts. Browser back, reload, `Esc`, and tab close must always work normally. The app only omits an *in-app* exit.
2. **No persistence.** No `localStorage`, `sessionStorage`, cookies, IndexedDB, URL state, or network calls.
3. **No runtime dependencies.**
4. Do not add any code path that stops, pauses, reverses, or decelerates the wheel. There is no "land on a winner" logic in this app and never will be.
5. Do not modify `src/wheel.ts`, `src/form.ts`, or their tests.
6. Do not use `requestAnimationFrame` to drive the rotation. CSS keyframes on a composited `transform` stay smooth when the tab is backgrounded and under main-thread load; a JS-driven loop stutters and would expose the gag.

## Done criteria

Run each and report the actual output:

1. Before implementing: `npm test` shows the new `tests/spin.test.ts` cases **failing**. Report that you confirmed this, and that they fail for the right reason.
2. `npm run typecheck` — exits 0.
3. `npm test` — all tests pass, including the earlier smoke, wheel, form, and phase tests. Report the pass count; none may be skipped.
4. `npm run e2e` — all Playwright tests pass on both the `chromium` and `mobile` projects.
5. `npm run build` — succeeds.
6. **Manual check, required.** Run `npm run dev`, enter 8 options, click **Spin**, and watch the wheel. Confirm and report:
   - it accelerates smoothly from rest,
   - there is **no perceptible lurch or stutter at the ~1.5 second mark**,
   - it is still turning at a constant rate after at least 60 seconds,
   - the pointer stays put while the wheel turns.
   Report the final stage-2 duration you settled on. Stop the server afterward.
