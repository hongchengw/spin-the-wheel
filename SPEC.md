# Infinite Spin Trap — Specification

**This document is the single source of truth.** Code, tests, and the files in `tasks/` are all derived from it. If any of them disagree with this document, this document is correct and the other artifact is a bug.

---

## 1. Purpose

Infinite Spin Trap is a joke web app disguised as a sincere prize-wheel tool.

The intended user journey:

1. The user lands on a clean, professional-looking page with 8 empty text fields.
2. They invest real effort typing 8 custom options — dinner choices, chores, names.
3. They press **Spin**.
4. A polished SVG wheel appears with their options and begins to spin up convincingly.
5. It never slows. It never stops. It never lands on anything.
6. A large **STOP THE WHEEL** button is offered. It does nothing but taunt them.
7. Eventually they give up and reload the page.
8. Every input is blank. All that typing is gone.

**The entire joke depends on the app looking legitimate.** A user who suspects a gag in the first five seconds never invests enough to be trapped. Visual polish, smooth animation, and correct wheel geometry are therefore functional requirements, not decoration.

---

## 2. Hard constraints

### 2.1 The trap is social, not technical

The app must **never** hold the browser hostage. It is explicitly forbidden from using:

- `beforeunload` / `onbeforeunload` handlers
- `history.pushState` / `replaceState` loops or any back-button trapping
- Fullscreen API, Pointer Lock API, or Screen Wake Lock
- Keyboard focus traps, `Esc` interception, or blocking of browser shortcuts
- `window.open` popups, popunders, or redirect chains
- Any attempt to disable right-click, devtools, refresh, or navigation

The only thing missing is an **in-app** exit. Browser back, reload, `Esc`, tab close, and window close all behave exactly as they would on any normal page, at every moment. The user is always one keystroke from freedom — they just have to think of it.

### 2.2 No persistence, ever

Reload must destroy all user input. That is the punchline. The app must not use:

- `localStorage`, `sessionStorage`
- Cookies, IndexedDB, Cache Storage
- URL query params or hash state
- Any server or network call

Browsers additionally restore form field values on soft reload via form-state restoration and bfcache. This is a real threat to the joke and must be actively defeated — see §6.3.

### 2.3 No way back

Once the wheel is spinning there is no in-app route to the setup screen. No reset button, no back link, no keyboard shortcut. The setup panel is **removed from the DOM**, not merely hidden, so it cannot be reached by tabbing or by a curious user unhiding it in devtools without a reload.

---

## 3. Screens

The app has exactly two phases, tracked by a class on `<body>`.

| Phase | Body class | Contents |
|---|---|---|
| Setup | `setup` | Title, subtitle, 8 labeled text inputs, **Spin** button |
| Spinning | `spinning` | Title, pointer, spinning wheel, **STOP THE WHEEL** button, taunt line |

The transition `setup → spinning` fires once, on **Spin**, and is **one-way**. There is no reverse transition.

---

## 4. Wheel geometry

Canonical constants. All coordinates are in SVG user units.

| Constant | Value |
|---|---|
| viewBox | `0 0 400 400` |
| Center | `(200, 200)` |
| Wheel radius | `180` |
| Slice count | `8` |
| Slice angle | `45°` |
| Label radius | `115` |
| Hub radius | `34` |

### 4.1 Slice paths

For slice index `i` (0-based):

```
a0 = i * 45 - 90        // degrees
a1 = a0 + 45
x(a) = 200 + 180 * cos(a * PI / 180)
y(a) = 200 + 180 * sin(a * PI / 180)

d = `M 200 200 L ${x(a0)} ${y(a0)} A 180 180 0 0 1 ${x(a1)} ${y(a1)} Z`
```

The `-90` offset places the leading edge of slice 0 at 12 o'clock, directly under the pointer.

Coordinates are rounded to 3 decimal places when serialized into the `d` attribute, so output is deterministic and unit-testable.

### 4.2 Labels

One `<text>` element per slice, with `bisector = a0 + 22.5`.

The text is authored **on the +x axis** and rotated into place, rather than positioned at a computed point. This is what makes it read outward along the spoke instead of staying horizontal:

- `x="315"` (i.e. `200 + 115`), `y="200"`
- `text-anchor="middle"`, `dominant-baseline="middle"`
- `transform="rotate(${bisector} 200 200)"`

The rotation carries the text to its final position on the bisector at radius `115` *and* aligns its baseline with the radius. For slice 0 (`bisector = -67.5`) this resolves to `(244.009, 93.754)`.

### 4.3 Label truncation

Text spilling past the rim is the single most obvious tell that the wheel is fake. Therefore:

- Labels longer than **14 characters** are truncated to 13 characters plus `…` (U+2026), for 14 characters total.
- If **any** label (post-truncation) exceeds 10 characters, every label's `font-size` steps down from `17px` to `14px`. Uniform sizing across slices — mismatched font sizes look broken.

### 4.4 Palette

Eight slice colors, defined once as CSS custom properties `--slice-1` … `--slice-8` and referenced by the SVG fills. Alternating warm/cool so adjacent slices always contrast. Theming lives in CSS only; `wheel.ts` never hardcodes a hex value.

### 4.5 Draw order

Slices → hub circle → rim stroke. Hub and rim are drawn last so they render on top of the slice edges.

---

## 5. Animation

### 5.1 What rotates

The **container `<div>`** wrapping the SVG rotates — not an SVG node. Rotating an SVG element with CSS requires `transform-box` / `transform-origin` handling that differs across browsers; rotating a plain div does not. The pointer lives outside this container and therefore stays still.

### 5.2 Two-stage spin

```css
@keyframes spin-up { from { transform: rotate(0deg);    }
                     to   { transform: rotate(1440deg); } }
@keyframes spin    { from { transform: rotate(0deg);    }
                     to   { transform: rotate(360deg);  } }
```

- **Stage 1 (spin-up):** `spin-up 1.5s cubic-bezier(.3, 0, .7, .4) forwards` — 4 full turns, accelerating.
- **Handoff:** on the `animationend` event, JS swaps the class so stage 2 begins.
- **Stage 2 (spin):** `spin .45s linear infinite` — constant rate, forever.

Both stages start and end at whole multiples of 360°, so the handoff is geometrically seamless.

**The stage-2 duration must be tuned to match the terminal velocity of the stage-1 easing curve.** If stage 2 is slower than the speed stage 1 ended at, the wheel visibly lurches at the 1.5s mark — the one moment that would give the whole gag away. `.45s` is the starting value; verify it visually and adjust if a seam is perceptible.

`will-change: transform` on the rotating container.

### 5.3 Pointer

A fixed pip at 12 o'clock, layered above the wheel, with a drop shadow. It carries a subtle tick wobble animation (~`0.45s`, synced to slice passage). A perfectly still pointer over a spinning wheel reads as a broken render.

### 5.4 Reduced motion

`prefers-reduced-motion` is **intentionally not honored for the wheel**. The spin is the app's entire function; a static wheel would be a blank screen with no explanation. It **is** honored for incidental motion: the stop-button press animation and the taunt fade.

---

## 6. Behavior

### 6.1 Inputs

Eight `<input type="text">` elements, generated by JS:

- `id="opt-1"` … `id="opt-8"`
- `placeholder="Option 1"` … `placeholder="Option 8"`
- `maxlength="24"`
- `autocomplete="off"`
- Each with an associated `<label>`

### 6.2 Blank handling

On **Spin**, each field's value is trimmed. Any field that is empty after trimming falls back to `Option N` (1-based). The wheel is therefore always complete; spinning with an entirely blank form is allowed and produces `Option 1` … `Option 8`.

### 6.3 Defeating form restoration

Two defenses, both required:

1. `autocomplete="off"` on the `<form>` element **and** on every `<input>`.
2. A one-shot clear of all 8 fields on the `pageshow` event, which fires on both fresh loads and bfcache restores.

Neither alone is reliable across browsers.

### 6.4 Fake stop button

Label: **STOP THE WHEEL**. Clicking it updates a taunt line and plays a brief press/shake animation on the button, so it feels genuinely wired up. It never touches the wheel.

Taunt sequence, by click count (1-based):

| Click | Text |
|---|---|
| 1 | `Slowing down…` |
| 2 | `Almost there…` |
| 3 | `Just one more rotation.` |
| 4 | `Hold on — recalibrating.` |
| 5 | `Nearly stopped now.` |
| 6+ | `No.` |

Click 6 and every click after it — 7, 50, 1000 — returns `No.` This is implemented as a pure function `tauntFor(clickCount: number): string` so it is unit-testable without a DOM.

---

## 7. Copy

| Element | Text |
|---|---|
| Page title / `<h1>` | `Infinite Spin Trap` |
| Subtitle (setup) | `Enter your options. Let the wheel decide.` |
| Spin button | `Spin` |
| Stop button | `STOP THE WHEEL` |
| Taunt line (initial) | *(empty)* |

The subtitle is played completely straight. No winking.

---

## 8. Responsive

| Viewport | Layout |
|---|---|
| ≥ 560px | Inputs in a 2-column grid |
| < 560px | Inputs in a single column |

The wheel is sized `min(88vw, 420px)` with `aspect-ratio: 1`.

**At 375×667 (iPhone SE), the spinning view must fit in one viewport with no scrolling** — wheel, pointer, stop button, and taunt line all visible at once. The page must never scroll horizontally in either phase.

---

## 9. Architecture

No runtime dependencies. Vite + vanilla TypeScript, strict mode.

| File | Responsibility |
|---|---|
| `index.html` | App shell and mount points |
| `src/main.ts` | State, wiring, phase switch |
| `src/form.ts` | `renderSetupPanel(host)`, `readLabels()` — input generation and blank fallback |
| `src/wheel.ts` | `buildWheel(labels: string[]): SVGSVGElement` — pure geometry, no app state |
| `src/taunts.ts` | `tauntFor(clickCount: number): string` — pure |
| `src/style.css` | Layout, theme, palette, keyframes |

`wheel.ts` and `taunts.ts` are pure and side-effect free, and `form.ts` is isolated from app state — that is what makes geometry, taunts, and form behavior testable without a browser.

---

## 10. Testing

Test-first is mandatory. For every unit of behavior: write the test, watch it fail for the right reason, then implement.

| Layer | Tool | Covers |
|---|---|---|
| Unit | Vitest | Wheel geometry, truncation, taunt sequence |
| DOM | Vitest + jsdom | Input generation, blank fallback, `pageshow` clear |
| E2E | Playwright | Spin lifecycle, never-stops, reload wipes, no dialogs, mobile layout |

Some properties are only observable in a real browser and **must** be E2E, not jsdom:

- The wheel is still rotating at t≈8s (sample `getComputedStyle(...).transform` at two times, assert the matrix changed).
- `animation-iteration-count` resolves to `infinite`.
- Reload and bfcache restore leave all inputs empty.
- No `beforeunload` dialog appears on navigation away.
- No horizontal scroll at 375×667.

---

## 11. Acceptance checklist

1. `npm run typecheck` — clean under `strict`.
2. `npm test` — all unit and jsdom tests pass, none skipped.
3. `npm run e2e` — all Playwright tests pass.
4. `npm run build && npm run preview` — production bundle behaves identically to dev.
5. 8 distinct options render on the correct slices, all text inside the rim.
6. Spin-up accelerates smoothly into a constant rate with **no perceptible lurch at ~1.5s**.
7. Still spinning at a constant rate after several minutes — no drift, no restart.
8. A 24-character option truncates cleanly rather than spilling off the wheel.
9. Blank fields render as `Option N`.
10. **STOP THE WHEEL** advances taunts to `No.` and stays there; wheel unaffected.
11. Reload wipes every input. `grep -ri "localstorage\|sessionstorage\|cookie\|indexeddb" src/` returns nothing.
12. While spinning: browser back, reload, `Esc`, and tab close all work with no prompt and no block.
13. At 375×667 the form is one column and the spinning view fits without scrolling.
