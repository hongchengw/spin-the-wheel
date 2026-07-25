# Task 03 — Wheel geometry

## Your context

You are working on a web app called **Infinite Spin Trap**. This file is your complete context — you have not seen the project spec or any other task file, and you should not assume anything not written here.

Working directory: `C:\Users\hongc\OneDrive\Projects\spinthewheelahh\spin-the-wheel` (Windows).

## Prerequisite state

Previous tasks set up a Vite + TypeScript project with a test harness. The repo has:

```
package.json        scripts: dev / build / preview / typecheck / test / test:watch / e2e
                    devDeps: vite, typescript, vitest, jsdom, @playwright/test. No runtime deps.
tsconfig.json       strict: true, ES2020, moduleResolution bundler, noEmit; includes src, tests, e2e
vite.config.ts      Vite config + Vitest config (environment: 'jsdom', include: ['tests/**/*.test.ts'])
playwright.config.ts
index.html          shell with <body class="setup">, #setup-panel, #spin-panel
src/main.ts         near-empty entry, imports './style.css'
src/style.css       reset + theme custom properties, including --slice-1 … --slice-8
tests/smoke.test.ts
e2e/smoke.spec.ts
```

Vitest runs with `environment: 'jsdom'`, so `document` is available in `tests/*.test.ts`. Import `describe` / `it` / `expect` explicitly from `vitest`.

`src/style.css` already defines eight slice colors as custom properties `--slice-1` through `--slice-8`.

## What the app does

The user fills 8 text fields with custom options, presses **Spin**, and an SVG prize wheel appears with their options and starts spinning — forever. This task builds **only the wheel geometry**. Nothing about spinning, forms, or app state belongs here.

## Goal

Create `src/wheel.ts` exporting one pure function:

```ts
export function buildWheel(labels: string[]): SVGSVGElement
```

It takes exactly 8 label strings and returns a detached `<svg>` element. It is **pure** — no app state, no side effects, no DOM insertion, no reading from `document` beyond `createElementNS`. This purity is what makes it unit-testable.

## Spec

### Constants

| Constant | Value |
|---|---|
| viewBox | `0 0 400 400` |
| Center | `(200, 200)` |
| Wheel radius | `180` |
| Slice count | `8` |
| Slice angle | `45°` |
| Label radius | `115` |
| Hub radius | `34` |

### Slice paths

For slice index `i` (0-based):

```
a0 = i * 45 - 90        // degrees
a1 = a0 + 45
x(a) = 200 + 180 * cos(a * PI / 180)
y(a) = 200 + 180 * sin(a * PI / 180)

d = `M 200 200 L ${x(a0)} ${y(a0)} A 180 180 0 0 1 ${x(a1)} ${y(a1)} Z`
```

The `-90` offset puts the leading edge of slice 0 at 12 o'clock, directly under the pointer.

**Rounding:** every coordinate is rounded to at most 3 decimal places with trailing zeros stripped — `Math.round(v * 1000) / 1000`, then stringified normally. So `200.00000000000003` serializes as `200`, not `200.000`. This keeps output deterministic and exactly assertable.

Each slice path gets `fill="var(--slice-N)"` where `N` is `i + 1` (so slice 0 → `var(--slice-1)`). Never hardcode a hex color in this file — the palette lives in CSS.

### Labels

One `<text>` per slice, with `bisector = a0 + 22.5`.

Author the text **on the +x axis and rotate it into place** — do not compute a position and place it there. Rotating is what makes the text read outward along the spoke rather than staying horizontal:

- `x="315"` (that is `200 + 115`), `y="200"`
- `text-anchor="middle"`, `dominant-baseline="middle"`
- `transform="rotate(${bisector} 200 200)"`

The rotation carries the text to its final spot on the bisector at radius `115` *and* aligns its baseline with the radius. For slice 0, `bisector` is `-67.5` and the text resolves to `(244.009, 93.754)`.

Round `bisector` the same way as coordinates. Values are `-67.5`, `-22.5`, `22.5`, `67.5`, `112.5`, `157.5`, `202.5`, `247.5`.

### Label truncation

Text spilling past the rim is the single most obvious tell that the wheel is fake. So:

- A label longer than **14 characters** is truncated to its first **13** characters plus `…` (U+2026, a single character), giving 14 characters total.
- A label of exactly 14 characters or fewer is left alone.
- If **any** label — measured after truncation — is longer than **10** characters, then **every** label's `font-size` steps down from `17px` to `14px`. The size is uniform across all 8 slices; mismatched font sizes look broken.

### Draw order

Slices first, then the hub circle (r = 34), then the rim stroke. Hub and rim render on top of the slice edges.

### Input validation

`buildWheel` expects exactly 8 labels. If given a different count, throw an `Error` with a clear message. Do not silently pad or truncate the array.

## Tests to write first — `tests/wheel.test.ts`

Write these, run them, and confirm they fail because `src/wheel.ts` does not exist yet. Then implement until they pass.

1. **Returns an SVG element** with `viewBox="0 0 400 400"`.
2. **Renders 8 slice paths.** Query `path` elements; expect exactly 8.
3. **Slice 0 has the exact expected `d`:**
   `M 200 200 L 200 20 A 180 180 0 0 1 327.279 72.721 Z`
   Assert the full string. This is the test that catches sign errors, degree/radian mistakes, and rounding drift.
4. **Slice 2's `d` starts the arc at the 0°/3-o'clock point.** For `i = 2`, `a0 = 0`, so the first line-to is `L 380 200`. Assert the `d` contains `L 380 200`.
5. **Each slice uses its palette variable.** Slice `i` has `fill="var(--slice-${i+1})"`. Check at least slices 0 and 7.
6. **Renders 8 text elements**, whose text contents in order equal the 8 input labels (using short labels that won't truncate).
7. **Rotation transforms are correct.** The 8 `text` elements have `transform` values `rotate(-67.5 200 200)`, `rotate(-22.5 200 200)`, `rotate(22.5 200 200)`, `rotate(67.5 200 200)`, `rotate(112.5 200 200)`, `rotate(157.5 200 200)`, `rotate(202.5 200 200)`, `rotate(247.5 200 200)`.
8. **Text is authored on the +x axis:** every `text` has `x="315"` and `y="200"`.
9. **A 14-character label is not truncated.** `'ExactlyFourtn'` is 13; use a precise 14-char string and assert it survives intact.
10. **A 15-character label is truncated** to 13 characters plus `…`, total length 14. Assert the exact resulting string.
11. **A 24-character label is truncated** to the same 14-character form. (24 is the input `maxlength` the form will use, so this is the realistic worst case.)
12. **Font size is `17px` when all labels are short** (≤ 10 characters).
13. **Font size is `14px` for every slice when one label is long** (> 10 characters after truncation) — assert all 8, not just the long one, to lock in the uniformity rule.
14. **Hub and rim exist** and are the last children, drawn after the slices.
15. **Throws on the wrong label count** — assert it throws for 7 labels and for 9 labels.

## Implementation notes

- Build elements with `document.createElementNS('http://www.w3.org/2000/svg', tag)`. Using `createElement` produces HTML elements that look right in a string dump but are not real SVG nodes.
- Keep the degree→radian conversion in one small helper; duplicating `* Math.PI / 180` inline is where sign errors creep in.
- Do not insert the returned element into `document`. The caller does that.

## Constraints

1. **The trap is social, not technical.** Never add `beforeunload`, history/back-button trapping, fullscreen or pointer lock, focus traps, or anything blocking browser shortcuts.
2. **No persistence.** No `localStorage`, `sessionStorage`, cookies, IndexedDB, URL state, or network calls.
3. **No runtime dependencies.**
4. Do not modify `index.html`, `src/main.ts`, `playwright.config.ts`, or the existing smoke tests in this task. You may add the slice-color usage but not change the palette values in `src/style.css`.

## Done criteria

Run each and report the actual output:

1. Before implementing: `npm test` shows the new `tests/wheel.test.ts` cases **failing** because `src/wheel.ts` is missing. Report that you confirmed this.
2. `npm run typecheck` — exits 0.
3. `npm test` — all tests pass, including the pre-existing smoke test. Report the pass count; none may be skipped.
4. `npm run build` — succeeds.
