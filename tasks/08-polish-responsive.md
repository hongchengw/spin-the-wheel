# Task 08 — Polish and responsive layout

## Your context

You are working on a web app called **Infinite Spin Trap**. This file is your complete context — you have not seen the project spec or any other task file, and you should not assume anything not written here.

Working directory: `C:\Users\hongc\OneDrive\Projects\spinthewheelahh\spin-the-wheel` (Windows).

## Prerequisite state

Previous tasks built the whole app. It works; it is not yet polished. The repo has:

```
package.json        scripts: dev / build / preview / typecheck / test / test:watch / e2e
tsconfig.json       strict: true; includes src, tests, e2e
vite.config.ts      Vite + Vitest (environment: 'jsdom', include: ['tests/**/*.test.ts'])
playwright.config.ts   projects: 'chromium' (desktop) and 'mobile' (375x667); per-test timeout >= 30s
index.html          shell (below)
src/main.ts         wiring, phase switch, spin handoff, stop-button handler
src/form.ts         renderSetupPanel / readLabels / clearFields
src/wheel.ts        buildWheel(labels): SVGSVGElement
src/taunts.ts       tauntFor(clickCount): string
src/style.css       reset, theme custom properties, stage layout, keyframes  — your main file this task
tests/*.test.ts     smoke, wheel, form, phase, spin, taunts, stop-button
e2e/*.spec.ts       smoke, form, phase, spin, stop
```

`index.html` body:

```html
<body class="setup">
  <main class="app">
    <header class="masthead">
      <h1 class="title">Infinite Spin Trap</h1>
      <p class="subtitle">Enter your options. Let the wheel decide.</p>
    </header>
    <section id="setup-panel" class="panel"></section>
    <section id="spin-panel" class="panel" hidden></section>
  </main>
</body>
```

Setup phase renders into `#setup-panel`:

```html
<form id="options-form" autocomplete="off">
  <!-- 8 groups of: <label for="opt-N">Option N</label>
                    <input type="text" id="opt-N" maxlength="24" autocomplete="off"> -->
  <button type="submit" id="spin-btn">Spin</button>
</form>
```

Spinning phase renders into `#spin-panel`:

```html
<div class="stage">
  <div class="pointer" aria-hidden="true"></div>
  <div class="wheel" id="wheel"><svg viewBox="0 0 400 400">…</svg></div>
</div>
<div class="controls">
  <button type="button" id="stop-btn" class="stop-btn">STOP THE WHEEL</button>
  <p id="taunt" class="taunt" role="status" aria-live="polite"></p>
</div>
```

Existing theme custom properties on `:root`:

```
--bg: #12131a      --surface: #1c1e29    --text: #f2f3f7
--muted: #9aa0b4   --accent: #ffc94d
--slice-1 … --slice-8   (eight alternating warm/cool slice colors)
```

## What the app does

The user fills 8 text fields with custom options, presses **Spin**, and an SVG prize wheel appears with their options and spins — forever. It never stops and never lands. A **STOP THE WHEEL** button does nothing but show escalating taunts ending in `No.` Reloading wipes every input.

**The entire joke depends on the app looking sincere.** A user who suspects a gag in the first five seconds never invests enough effort to feel trapped. Visual polish is therefore a functional requirement of this app, not decoration. That is what this task is for.

## Goal

Make it look like a real, well-made tool. Then make it work properly on a phone.

## Spec

### Visual polish

Work almost entirely in `src/style.css`. Aim for a calm, confident, slightly premium dark UI — the kind of thing someone would trust.

- **Type scale.** Establish a real scale rather than ad-hoc sizes. The `<h1>` should be clearly dominant; labels small and quiet; the stop button large. Set a comfortable `line-height` on body text and tighten it on the heading.
- **Spacing rhythm.** Use a consistent spacing step (custom properties like `--space-1` … `--space-5`) instead of scattered arbitrary pixel values.
- **Inputs.** Give them `--surface` backgrounds, a subtle 1px border, generous padding, rounded corners, and a clear `:focus-visible` state using `--accent`. They should feel pleasant to type into — this is where the user invests the effort that makes the trap land.
- **Spin button.** The primary action of the setup screen: full-width or near it, `--accent`, strong contrast, obvious hover and `:active` states.
- **Wheel.** A crisp rim, a subtle outer glow or drop shadow so it lifts off the background, and a clean hub. Slice label text should be legible against every one of the 8 slice colors — check all eight, and adjust the text fill or add a subtle text shadow if any pairing is weak.
- **Pointer.** Should read as a real physical pointer sitting above the rim, with a drop shadow.
- **Focus states.** Every interactive element needs a visible `:focus-visible` ring. Do not use `outline: none` without a replacement.

Restraint beats decoration. No gradients-on-everything, no heavy glows, no more than the palette already defines. If a change makes it look more like a toy, revert it.

### Responsive layout

| Viewport | Inputs |
|---|---|
| ≥ 560px | 2-column grid |
| < 560px | single column |

Use a media query at `560px` (or a `minmax`-based `grid-template-columns` that collapses naturally — either is fine, but verify the actual behavior at the boundary).

**Hard requirement: at 375×667 (iPhone SE), the spinning view must fit entirely within one viewport with no scrolling.** The wheel, pointer, stop button, and taunt line must all be visible at once without the user scrolling. Size the wheel with something like `min(88vw, 420px)` and cap it further by viewport height if needed so the controls are never pushed below the fold.

**The page must never scroll horizontally, in either phase, at any viewport.** Do not paper over an overflow with `overflow-x: hidden` — find the element that is too wide and fix it. `overflow-x: hidden` hides the symptom and leaves a layout bug that will resurface.

The setup form at 375px wide may scroll vertically — 8 inputs plus a button legitimately do not fit. That is fine and expected. Only the spinning view has the no-scroll requirement.

### Do not break behavior

This is a styling task. The app's behavior is already correct and tested:

- The wheel spins forever and never stops.
- The stop button does nothing to the wheel.
- Reload wipes all inputs.
- There is no in-app way back to the setup screen.

Do not change any of that. Every existing test must still pass unmodified.

One CSS-specific trap: **do not add a `@media (prefers-reduced-motion: reduce)` rule that stops or disables the wheel's rotation.** The spin is the app's entire function; a static wheel would be a blank screen. Incidental motion — the stop-button shake, the pointer tick, any transitions you add — should be disabled under reduced motion.

## Tests to write first — `e2e/responsive.spec.ts` (Playwright)

Layout is only observable in a real browser. Write these, run them, confirm they fail (or pass trivially — if a test passes before you touch anything, tighten it until it is actually measuring the requirement), then implement.

1. **No horizontal scroll in the setup phase, mobile.** At 375×667, assert `document.documentElement.scrollWidth <= clientWidth`.
2. **No horizontal scroll in the spinning phase, mobile.** Same assertion after clicking **Spin**.
3. **No horizontal scroll at desktop width** in both phases.
4. **The spinning view fits one viewport at 375×667.** After spinning, assert `document.documentElement.scrollHeight <= clientHeight + 1` (the 1px tolerance absorbs sub-pixel rounding).
5. **The stop button is in the viewport at 375×667** without scrolling — check its bounding box is fully within `{0, 0, 375, 667}`.
6. **The taunt line is in the viewport at 375×667** after spinning.
7. **The wheel is not clipped** — its bounding box width and height are both > 0 and it sits fully within the viewport horizontally.
8. **Single-column inputs below 560px** — at 375px wide, assert the bounding boxes of `#opt-1` and `#opt-2` do not overlap horizontally (i.e. `#opt-2` sits below `#opt-1`, so their `y` values differ).
9. **Two-column inputs at ≥ 560px** — at 900px wide, assert `#opt-1` and `#opt-2` share roughly the same `y` (they are side by side).

Run these against the `mobile` and `chromium` Playwright projects as appropriate; you may set explicit viewports inside the tests with `page.setViewportSize` where a test needs a specific width.

## Constraints

1. **The trap is social, not technical.** Never add `beforeunload`, history/back-button trapping, fullscreen or pointer lock, focus traps, or anything blocking browser shortcuts. Browser back, reload, `Esc`, and tab close must always work normally.
2. **No persistence.** No `localStorage`, `sessionStorage`, cookies, IndexedDB, URL state, or network calls.
3. **No runtime dependencies.** No CSS frameworks, no icon packages, no web fonts fetched over the network — use a system font stack.
4. **Do not weaken or delete any existing test** to make your styling pass. If an existing test genuinely conflicts with a requirement here, stop and report the conflict rather than editing the test.
5. Keep changes to `src/*.ts` minimal — this is a CSS task. Adding a class name or wrapper element is fine; changing behavior is not.

## Done criteria

Run each and report the actual output:

1. Before implementing: `npm run e2e` shows the new `e2e/responsive.spec.ts` cases **failing**. Report that you confirmed this, and that they fail for the right reason.
2. `npm run typecheck` — exits 0.
3. `npm test` — all existing unit and jsdom tests still pass, unmodified. Report the pass count.
4. `npm run e2e` — all Playwright tests pass on both the `chromium` and `mobile` projects, including the new responsive suite.
5. `npm run build` — succeeds.
6. **Manual check, required.** `npm run dev`, then:
   - At desktop width: enter 8 options and spin. Confirm it looks like a real, polished tool — report your honest assessment, and say so if some part still looks unfinished.
   - Read all 8 slice labels against their slice colors. Confirm every one is legible; report any pairing you had to adjust.
   - In devtools device mode at 375×667: confirm the form is single-column, and that after spinning the wheel, stop button, and taunt line are all visible without scrolling.
   - Confirm the wheel still spins forever and the stop button still does nothing.

   Stop the server afterward.
