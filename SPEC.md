# Normal Spin The Wheel — Specification

**This document is the single source of truth.** Code, tests, and the files in `tasks/` are all derived from it. If any of them disagree with this document, this document is correct and the other artifact is a bug.

---

## 1. Purpose

Infinite Spin Trap is a joke web app disguised as a sincere prize-wheel tool.

The intended user journey:

1. The user lands on a clean, professional-looking page with **eight empty text fields by default** (they may add or remove rows to hold anywhere from **2 to 12** options).
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
| Setup | `setup` | Eyebrow, title, subtitle, variable option list (2–12 rows), duplicate notice, **Spin** button |
| Spinning | `spinning` | Shrunk title, pointer, spinning wheel, **instrument panel** (rate / elapsed / confidence / countdown, mute), **STOP THE WHEEL** button, taunt line |

The transition `setup → spinning` fires once, on **Spin**, and is **one-way**. There is no reverse transition.

---

## 4. Wheel geometry

Canonical constants. All coordinates are in SVG user units.

| Constant | Value |
|---|---|
| viewBox | `0 0 400 400` |
| Center | `(200, 200)` |
| Wheel radius | `180` |
| Slice count | `2` … `12` (inclusive), from the form at spin time |
| Slice angle | `360° / count` |
| Label radius | `115` |
| Hub radius | `34` |
| Radial label budget | `122` user units (see §4.3) |

### 4.1 Slice paths

For slice index `i` (0-based) and slice count `n`:

```
sliceAngle = 360 / n
a0 = i * sliceAngle - 90        // degrees
a1 = a0 + sliceAngle
x(a) = 200 + 180 * cos(a * PI / 180)
y(a) = 200 + 180 * sin(a * PI / 180)

largeArc = sliceAngle > 180 ? 1 : 0
d = `M 200 200 L ${x(a0)} ${y(a0)} A 180 180 0 ${largeArc} 1 ${x(a1)} ${y(a1)} Z`
```

The `-90` offset places the leading edge of slice 0 at 12 o'clock, directly under the pointer.

Coordinates are rounded to 3 decimal places when serialized into the `d` attribute, so output is deterministic and unit-testable.

### 4.2 Labels

One `<text>` element per slice, with `bisector = a0 + sliceAngle / 2`.

The text is authored **on the +x axis** and rotated into place, rather than positioned at a computed point. This is what makes it read outward along the spoke instead of staying horizontal:

- `x="315"` (i.e. `200 + 115`), `y="200"`
- `text-anchor="middle"`, `dominant-baseline="middle"`
- `transform="rotate(${bisector} 200 200)"`

The rotation carries the text to its final position on the bisector at radius `115` *and* aligns its baseline with the radius. For slice 0 (`bisector = -67.5`) this resolves to `(244.009, 93.754)`.

### 4.3 Label truncation

Text spilling past the rim is the single most obvious tell that the wheel is fake. Labels run **radially** along a spoke; the usable length is set by hub-to-rim distance and does **not** grow when there are fewer, wider slices.

- **`LABEL_BUDGET = 122`** user units: text is centred at radius `115`, so each end may extend `61` units along the spoke and must stay clear of the `180` rim.
- **`estimateLabelWidth(text, fontSize)`** sums per-character advance widths (semibold humanist sans averages) and compares to the budget. Characters are trimmed from the end until the string fits; if anything was removed, the result ends with `…` (U+2026).
- **Font size** depends on slice count (wider slices use slightly larger type for legibility) and steps down **uniformly for every slice** if any label still exceeds the budget at the base size for that count. Mismatched font sizes across slices look broken.

There is no fixed character-count cap. Wide glyphs (e.g. `W`) truncate sooner than narrow ones (`i`) at the same length.

### 4.4 Palette and theme

**Visual direction:** light editorial minimal — warm off-white canvas (`--bg`), white surfaces, ink typography, system serif display face (no webfonts; no runtime network fetch for fonts).

**Twelve** pale slice fills `--slice-1` … `--slice-12` and matching label inks `--slice-ink-1` … `--slice-ink-12`. Each label uses the ink paired with its own fill so contrast is handled in the palette; labels carry **no** outline or text shadow. `wheel.ts` references only CSS variables, never hex. Colours cycle by slice index when count ≤ 12.

### 4.5 Draw order

Slices → hub circle → rim stroke. Hub and rim are drawn last so they render on top of the slice edges.

---

## 5. Animation

### 5.1 What rotates

The **container `<div>`** wrapping the SVG rotates — not an SVG node. Rotating an SVG element with CSS requires `transform-box` / `transform-origin` handling that differs across browsers; rotating a plain div does not. The pointer lives outside this container and therefore stays still.

### 5.2 Two-stage spin

```css
@keyframes spin-up { from { transform: rotate(0deg);   }
                     to   { transform: rotate(720deg); } }
@keyframes spin    { from { transform: rotate(0deg);   }
                     to   { transform: rotate(360deg); } }
```

- **Stage 1 (spin-up):** `spin-up 2s cubic-bezier(.3, 0, .55, .5) forwards` — 2 full turns, accelerating from rest.
- **Handoff:** on the `animationend` event, JS swaps the class so stage 2 begins, then backdates stage 2's `startTime` to the moment stage 1 ended.
- **Stage 2 (spin):** `spin .9s linear infinite` — 400°/s, constant, forever.

Both stages start and end at whole multiples of 360°, so the handoff is geometrically seamless.

**Backdating stage 2 is required, not an optimisation.** Stage 1 lands on 720° on a frame boundary, but `animationend` is only delivered on the following tick. Left alone, stage 2 then starts its own timeline from 0° one frame late — and since 720° and 0° are the same angle, the wheel renders the identical frame twice and drops ~6.7° of travel. That is a one-frame stall at exactly the moment the seam has to be invisible. Anchoring `startTime` to stage 1's end time absorbs the delivery delay instead, and self-corrects if the tick is delayed by more than one frame.

This needs its own test. A smoothed velocity trace cannot see a single dropped frame, so `e2e/spin.spec.ts` checks the seam twice: once smoothed, for a sustained lurch, and once per-frame and unsmoothed, for a stall.

**These numbers are derived backwards from the sustained speed, and must stay in sync.**

1. **Pick the forever speed first.** 400°/s (~1.1 rev/s) is quick enough to read as a real prize wheel but slow enough that the labels the user just typed stay legible as they pass. This is the binding constraint: the wheel is on screen indefinitely, and a permanent unreadable blur reads as a rendering bug rather than a sincere spin. (An earlier iteration ran at 1920°/s — seamless, but a blur.)
2. **Stage 1 must *end* at exactly that speed,** or the handoff lurches and gives the gag away. 720° over 2s averages 360°/s, so the easing must finish at `400 / 360 = 1.1111×` its average rate.
3. **A cubic-bezier ends with slope `(1 - y2) / (1 - x2)`.** `x2 = .55, y2 = .5` gives `.5 / .45 = 1.1111` exactly. Its start slope `y1 / x1 = 0 / .3 = 0`, so it still pulls away from a dead stop.

```
terminal velocity = endSlope × (totalRotation / duration)
                  = 1.1111 × (720° / 2s) = 400°/s = 360° / 0.9s
```

Known and accepted: the curve peaks at ~465°/s mid-windup (t≈1.26s) before easing back to 400°/s by t=2s. Any curve starting at slope 0 and ending above slope 1 must overshoot, since its average slope is 1 by construction. Measured at ≤10°/s per sample window, it is imperceptible, and it reads as a fling settling into a cruise. Removing it would cost a full turn of windup.

`e2e/spin.spec.ts` asserts against `SPIN_PERIOD_S`; change both together.

`will-change: transform` on the rotating container.

### 5.3 Pointer

A fixed pip at 12 o'clock, layered above the wheel. It carries a subtle ±2.5° tick wobble. A perfectly still pointer over a spinning wheel reads as a broken render.

The tick period is `0.45s`. On an eight-slice wheel at a `0.9s` spin period, one slice passes every `0.1125s`, and `0.45s` is exactly four of those — so the wobble stays roughly phase-locked at the default option count. Other slice counts drift slightly; that is acceptable.

### 5.4 Reduced motion

`prefers-reduced-motion` is **intentionally not honored for the wheel**. The spin is the app's entire function; a static wheel would be a blank screen with no explanation. It **is** honored for every incidental motion: the pointer tick, the stop-button press animation, the confidence-bar transition, and the input and button transitions.

---

## 6. Behavior

### 6.1 Inputs

Between **2 and 12** `<input type="text">` rows, generated by JS:

- `id="opt-1"` … `id="opt-N"` (contiguous renumbering when rows are added or removed)
- `placeholder="Option 1"` … `placeholder="Option N"`
- `maxlength="24"`
- `autocomplete="off"` on the form and every input
- Each row: colour **swatch** (upcoming slice fill), `<label>`, input, **remove** control (hidden at the 2-option floor)
- **Add option** control (hidden at 12 options); counter text `N of 12 options`
- **Enter** in a field focuses the next field; Enter in the last field submits
- **Duplicate notice:** trimmed, case-insensitive duplicates are highlighted and described in a live region; duplicates are allowed (each row still gets its own slice)

Default row count on first load: **8**.

### 6.2 Blank handling

On **Spin**, each field's value is trimmed. Any field that is empty after trimming falls back to `Option N` (1-based). The wheel is always complete; spinning with blank fields is allowed.

### 6.3 Defeating form restoration

Two defenses, both required:

1. `autocomplete="off"` on the `<form>` element **and** on every `<input>`.
2. A reset on the `pageshow` event (fresh loads and bfcache restores): all fields cleared and row count restored to the default **8**.

Neither alone is reliable across browsers.

### 6.4 Instrument panel and sound

After spin, a **`.instrument`** panel shows:

| Readout | Behaviour |
|---|---|
| **Rate** | Revolutions per minute, derived from measured wheel rotation (~400°/s sustained → ~66.7 rpm) |
| **Elapsed** | `M:SS` since spin began |
| **Confidence** | Fake percentage climbing toward 99% on a repeating curve, with a bar that never completes |
| **Countdown** | `Result in 3` → `2` → `1` → `Finalising result` → repeats forever |

**Mute** toggles a Web Audio synthesised tick on slice passage. Created only inside the Spin submit handler (autoplay policy). No audio files, no runtime npm dependency. If Web Audio is unavailable, the mute control is hidden and ticking is a no-op.

The stop button must **never** update any instrument readout.

### 6.5 Fake stop button

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
| Eyebrow (setup) | `Decision tool` |
| Subtitle (setup) | `Enter your options. Let the wheel decide.` |
| Spin button | `Spin` |
| Add option | `Add option` |
| Stop button | `STOP THE WHEEL` |
| Taunt line (initial) | *(empty)* |
| Countdown (examples) | `Result in 3`, `Result in 2`, `Result in 1`, `Finalising result` |

The subtitle is played completely straight. No winking.

---

## 8. Responsive

| Viewport | Layout |
|---|---|
| ≥ 560px | Inputs in a 2-column grid |
| < 560px | Inputs in a single column |

The wheel is sized `min(100% / 1.43, 62vh, 440px)` with `aspect-ratio: 1`, against a full-bleed stage that cancels the app's horizontal padding.

The `/ 1.43` is the load-bearing part. A square rotating about its centre sweeps a circle of `side × √2`, so a wheel sized to fit statically still pushes its corners past the viewport as it turns. Sizing it naively at `min(88vw, 420px)` gave a 330px wheel at 375px wide and a 418px-wide document whenever a corner faced the edge. The wheel is therefore sized from its **swept** footprint, not from its box; 1.43 is √2 plus a little slack for sub-pixel rounding. `62vh` then caps it on landscape phones and `440px` on wide desktops. It is a percentage rather than `vw` so the sizing never counts a scrollbar.

`overflow-x: hidden` is not an acceptable substitute for any of this. It hides the symptom and leaves the over-wide element in place.

**At 375×667 (iPhone SE), the spinning view must fit in one viewport with no scrolling** — wheel, pointer, stop button, and taunt line all visible at once. The page must never scroll horizontally in either phase.

---

## 9. Architecture

No runtime dependencies. Vite + vanilla TypeScript, strict mode.

| File | Responsibility |
|---|---|
| `index.html` | App shell and mount points |
| `src/main.ts` | Entry point — calls `initApp(document)`, nothing else |
| `src/app.ts` | State, wiring, phase switch, spin handoff, stop-button handler |
| `src/form.ts` | `renderSetupPanel(host)`, `readLabels(root)`, `clearFields(root)` — input generation, blank fallback, reload wipe |
| `src/wheel.ts` | `buildWheel(labels: string[]): SVGSVGElement` — pure geometry, no app state |
| `src/taunts.ts` | `tauntFor(clickCount: number): string` — pure |
| `src/style.css` | Layout, theme, palette, keyframes |

`wheel.ts` and `taunts.ts` are pure and side-effect free, and `form.ts` is isolated from app state — that is what makes geometry, taunts, and form behavior testable without a browser. `initApp` takes the root it operates on rather than reaching for `document`, so the phase switch can be driven against a synthetic container in jsdom.

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
6. Spin-up accelerates smoothly into a constant rate with **no perceptible lurch at the ~2s handoff**.
7. Still spinning at a constant rate after several minutes — no drift, no restart.
8. A 24-character option truncates cleanly rather than spilling off the wheel.
9. Blank fields render as `Option N`.
10. **STOP THE WHEEL** advances taunts to `No.` and stays there; wheel unaffected.
11. Reload wipes every input. `grep -ri "localstorage\|sessionstorage\|cookie\|indexeddb" src/` returns nothing.
12. While spinning: browser back, reload, `Esc`, and tab close all work with no prompt and no block.
13. At 375×667 the form is one column and the spinning view fits without scrolling.
