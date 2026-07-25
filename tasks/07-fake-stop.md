# Task 07 — Fake stop button

## Your context

You are working on a web app called **Infinite Spin Trap**. This file is your complete context — you have not seen the project spec or any other task file, and you should not assume anything not written here.

Working directory: `C:\Users\hongc\OneDrive\Projects\spinthewheelahh\spin-the-wheel` (Windows).

## Prerequisite state

Previous tasks built the project skeleton, test harness, wheel geometry, setup form, phase switch, and the infinite spin animation. The repo has:

```
package.json        scripts: dev / build / preview / typecheck / test / test:watch / e2e
tsconfig.json       strict: true; includes src, tests, e2e
vite.config.ts      Vite + Vitest (environment: 'jsdom', include: ['tests/**/*.test.ts'])
playwright.config.ts   projects: 'chromium' (desktop) and 'mobile' (375x667); per-test timeout >= 30s
index.html          shell with <body class="setup">, #setup-panel, #spin-panel
src/main.ts         app wiring, phase switch, spin-animation class handoff
src/form.ts         renderSetupPanel / readLabels / clearFields   — do not modify
src/wheel.ts        buildWheel(labels): SVGSVGElement             — do not modify
src/style.css       reset, theme custom properties, stage layout, spin keyframes
tests/*.test.ts     smoke, wheel, form, phase, spin
e2e/*.spec.ts       smoke, form, phase, spin
```

Current behavior: the user fills 8 inputs and clicks **Spin**. The setup panel is removed from the DOM, `<body>` switches from class `setup` to `spinning`, and `#spin-panel` is populated with:

```html
<div class="stage">
  <div class="pointer" aria-hidden="true"></div>
  <div class="wheel" id="wheel"><svg viewBox="0 0 400 400">…8 labeled slices…</svg></div>
</div>
```

The wheel spins up over 2s and then rotates forever at a constant 400°/s (a `0.9s` period) via CSS keyframes. The class handoff from the accelerating stage to the constant stage happens at the 2s mark. Theme custom properties available in `src/style.css` include `--bg`, `--surface`, `--text`, `--muted`, `--accent`.

## What the app does

This is a joke app. The wheel never stops. This task adds the cruelest part: a large, prominent **STOP THE WHEEL** button that appears to be the way out, and does nothing at all.

The button must feel genuinely wired up — it responds to every click with a visible animation and an updated status message. It just never affects the wheel.

## Goal

Add `src/taunts.ts` with a pure taunt function, and wire a fake stop button into the spinning panel.

## Spec

### `src/taunts.ts`

```ts
export function tauntFor(clickCount: number): string
```

Pure, no DOM, no state. `clickCount` is 1-based — the first click passes `1`.

| clickCount | Returns |
|---|---|
| 1 | `Slowing down…` |
| 2 | `Almost there…` |
| 3 | `Just one more rotation.` |
| 4 | `Hold on — recalibrating.` |
| 5 | `Nearly stopped now.` |
| 6 and every value above | `No.` |

Exact strings, exactly as written. Note the characters: `…` is U+2026 (a single ellipsis character, not three periods) and `—` is U+2014 (an em dash). Copy them verbatim.

Once it reaches `No.` it stays there permanently — click 6, 7, 50, and 1000 all return `No.` The escalating politeness collapsing into a flat refusal is the joke; do not cycle back to the start.

Guard the input: `clickCount` below 1 is not a valid click. Decide on sensible behavior and make it explicit — either throw or return the first taunt — and cover it with a test either way.

### Markup

Append to `#spin-panel`, after the existing `.stage` div:

```html
<div class="controls">
  <button type="button" id="stop-btn" class="stop-btn">STOP THE WHEEL</button>
  <p id="taunt" class="taunt" role="status" aria-live="polite"></p>
</div>
```

The taunt line starts **empty** — no text until the first click.

`aria-live="polite"` means a screen reader announces each new taunt, which is the correct sincere-app behavior.

### Click behavior

On each click of `#stop-btn`:

1. Increment an internal click counter.
2. Set `#taunt`'s text content to `tauntFor(count)`.
3. Play a brief press/shake animation on the button.
4. **Do nothing whatsoever to the wheel.**

The button must never gain a `disabled` attribute, never change its own label, and never be removed. It stays there, permanently inviting.

### Button styling

Make it look like the real primary action of the screen — large, high contrast, using `--accent`, with a clear hover and `:active` state and a visible `:focus-visible` ring. It should be the most prominent thing on the page after the wheel itself. A button that looks like a joke does not trap anybody.

Add a short shake or press keyframe (roughly 200–300ms) triggered per click. Since the same animation must replay on repeated clicks, remember that re-adding a class in the same frame will not restart a CSS animation — force a reflow, or remove the class on `animationend`, or use the Web Animations API. Test that the animation actually replays on the second click.

Under `@media (prefers-reduced-motion: reduce)`, disable the button shake. **Do not** disable the wheel's rotation under reduced motion — the spin is the app's entire function.

## Tests to write first

### `tests/taunts.test.ts` (Vitest, pure — no DOM needed)

1. **Click 1** returns `Slowing down…`.
2. **Clicks 1–5** return the five escalating strings in exact order. Assert each exact string.
3. **Click 6** returns `No.`
4. **Clicks 7, 50, and 1000** all return `No.` — it never cycles back.
5. **The ellipsis is U+2026,** not three periods. Assert `'Slowing down…'.length === 13` style precision, or assert the exact code point, so a well-meaning autocorrect can't silently break the copy.
6. **The em dash in click 4 is U+2014.** Same reasoning.
7. **Out-of-range input** (`0`, `-1`) behaves as you specified — assert whichever behavior you chose.

### `tests/stop-button.test.ts` (Vitest + jsdom)

Drive the app into its spinning phase the way the existing `tests/phase.test.ts` does, then:

8. **The stop button exists** after the phase switch, with id `stop-btn` and text `STOP THE WHEEL`.
9. **The taunt line starts empty.**
10. **First click sets the taunt** to `Slowing down…`.
11. **Six clicks land on `No.`** and a seventh leaves it at `No.`
12. **The button is never disabled** — after ten clicks, assert `disabled` is `false` and the button is still in the DOM.
13. **The button label never changes** — still `STOP THE WHEEL` after ten clicks.
14. **Clicking does not touch the wheel's classes.** Capture `wheel.className` before and after ten clicks and assert it is unchanged. This is the assertion that catches a well-meaning implementer who "fixes" the app by pausing the wheel.
15. **Clicking does not remove or replace the svg** — the same svg node is still inside `.wheel` afterward.

### `e2e/stop.spec.ts` (Playwright)

16. **Clicking STOP does not stop the wheel.** Spin up, wait past the 2s handoff (use ~2600ms, as the existing `e2e/spin.spec.ts` does), click the stop button five times, wait ~2s, then sample `getComputedStyle('.wheel').transform` twice ~200ms apart and assert the values **differ**. The wheel is still turning.
17. **`animation-play-state` is still `running`** after clicking the stop button.
18. **The shake animation replays on a second click** — verify the button's animation restarts rather than firing only once.
19. **Taunt text is visible on screen** and updates as clicks accumulate, ending at `No.`

## Constraints

1. **The trap is social, not technical.** Never add `beforeunload`, history/back-button trapping, fullscreen or pointer lock, focus traps, or anything blocking browser shortcuts. Browser back, reload, `Esc`, and tab close must always work normally at every moment. The app only omits an *in-app* exit — the stop button is a joke, not a hostage mechanism.
2. **No persistence.** No `localStorage`, `sessionStorage`, cookies, IndexedDB, URL state, or network calls. The click counter lives in memory only and resets on reload.
3. **No runtime dependencies.**
4. **Never make the stop button work,** even partially. No slowdown, no pause, no "stops after 20 clicks" easter egg. It does nothing to the wheel, forever.
5. Do not modify `src/wheel.ts`, `src/form.ts`, or their tests. Do not weaken or delete any existing test.

## Done criteria

Run each and report the actual output:

1. Before implementing: `npm test` shows the new taunt and stop-button cases **failing**. Report that you confirmed this, and that they fail for the right reason.
2. `npm run typecheck` — exits 0.
3. `npm test` — all tests pass, including smoke, wheel, form, phase, and spin. Report the pass count; none may be skipped.
4. `npm run e2e` — all Playwright tests pass on both the `chromium` and `mobile` projects.
5. `npm run build` — succeeds.
6. **Manual check, required.** `npm run dev`, enter 8 options, **Spin**, then click **STOP THE WHEEL** ten times. Confirm and report: each click shakes the button and updates the message, the messages escalate then settle on `No.`, and the wheel's speed is completely unaffected throughout. Stop the server afterward.
