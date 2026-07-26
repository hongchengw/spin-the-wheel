# Normal Spin The Wheel — Specification

**This document is the single source of truth.** Code, tests, and the files in `tasks/` are all derived from it. If any of them disagree with this document, this document is correct and the other artifact is a bug.

---

## 1. Purpose

Infinite Spin Trap is a joke web app disguised as a sincere prize-wheel tool.

The intended user journey:

1. The user lands on a clean, professional-looking page with **two empty text fields by default** (they may add or remove rows to hold anywhere from **2 to 12** options).
2. They invest real effort typing custom options — dinner choices, chores, names — adding a row each time they think of another one.
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
| Setup | `setup` | Eyebrow, title, subtitle, variable option list (2–12 rows, opening at 2), duplicate notice, **Spin** button |
| Spinning | `spinning` | Shrunk title, pointer, spinning wheel, corner mute toggle, **STOP THE WHEEL** button, taunt line |

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
@keyframes spin-up { from { transform: rotate(0deg);    }
                     to   { transform: rotate(4320deg); } }
@keyframes spin    { from { transform: rotate(0deg);    }
                     to   { transform: rotate(360deg);  } }
```

- **Stage 1 (spin-up):** `spin-up 6s cubic-bezier(.4, 0, .8, .2) forwards` — 12 full turns, accelerating from rest.
- **Handoff:** on the `animationend` event, JS swaps the class so stage 2 begins, then backdates stage 2's `startTime` to the moment stage 1 ended. No duration is hardcoded in JS — the end time is read off the animation's own computed timing, so retiming either stage is a CSS-only change.
- **Stage 2 (spin):** `spin .125s linear infinite` — 2880°/s (8 rev/s), constant, forever.

Both stages start and end at whole multiples of 360°, so the handoff is geometrically seamless.

**Backdating stage 2 is required, not an optimisation.** Stage 1 lands on 4320° on a frame boundary, but `animationend` is only delivered on the following tick. Left alone, stage 2 then starts its own timeline from 0° one frame late — and since 4320° and 0° are the same angle, the wheel renders the identical frame twice and drops ~48° of travel. That is a one-frame stall at exactly the moment the seam has to be invisible. Anchoring `startTime` to stage 1's end time absorbs the delivery delay instead, and self-corrects if the tick is delayed by more than one frame.

This needs its own test. A smoothed velocity trace cannot see a single dropped frame, so `e2e/spin.spec.ts` checks the seam twice: once smoothed, for a sustained lurch, and once per-frame and unsmoothed, for a stall.

The sustained speed also puts a ceiling on how those velocity traces may be measured. Rotation is always forward, so each sample gap is unwrapped into `[0, 360)` — and at 2880°/s a whole turn passes in 125ms, about 7.5 frames at 60Hz. A sampling window that spans a full turn aliases back down and reports a velocity far *lower* than the truth, which is indistinguishable from the lurch the test is hunting. The window is therefore 2 frames (~33ms, ~96°), and smoothing belongs in the median taken afterwards, never in a wider window. The per-frame stall check is likewise asymmetric around the seam: stage 2 is flat and tolerates any lookahead, but stage 1 is still accelerating hard, so a frame 20 back is legitimately ~0.75× terminal and would trip the floor for reasons that have nothing to do with a stall. Six frames back is the limit that keeps every sampled stage-1 frame clear of it.

**These numbers are derived backwards from the sustained speed, and must stay in sync.**

1. **Pick the forever speed first.** 2880°/s (8 rev/s) is well past the point where anything on the wheel can be read, and that is the point. The joke is a wheel that never lands, so the state it settles into should be an absurd, unmistakable blur — a speed no real prize wheel could hold — rather than a plausible one the eye can follow. Legibility of the typed labels is deliberately **not** a constraint on the sustained speed: the user reads them while typing and again through the slow opening of the wind-up.
2. **Stage 1 is a long tease, not a ramp.** Getting to the blur immediately would spend the gag in the first second, so the wind-up runs 6s from a dead stop: still under one full turn at t=2s, crossing 1000°/s only around t=4.4s, then running away in the last second. For as long as possible it sells "this is a normal wheel".
3. **Stage 1 must *end* at exactly the sustained speed,** or the handoff lurches and gives the gag away. 4320° over 6s averages 720°/s, so the easing must finish at `2880 / 720 = 4×` its average rate.
4. **A cubic-bezier ends with slope `(1 - y2) / (1 - x2)`.** `x2 = .8, y2 = .2` gives `.8 / .2 = 4` exactly. Its start slope `y1 / x1 = 0 / .4 = 0`, so it still pulls away from a dead stop.

```
terminal velocity = endSlope × (totalRotation / duration)
                  = 4 × (4320° / 6s) = 2880°/s = 360° / 0.125s
```

This curve accelerates continuously: its slope climbs monotonically from 0 to 4 and peaks exactly at the handoff, so there is no mid-windup overshoot to ease back down from, and stage 2 takes over at the fastest the wheel has ever been. Verified over 200k samples of the curve and confirmed empirically in Chromium, where the measured worst frame-to-frame drop across the whole wind-up is 0. (A curve ending only slightly above its average slope has nowhere to put the missing travel and *must* overshoot mid-windup; ending at 4× leaves room to spare.)

`e2e/spin.spec.ts` asserts against `SPIN_PERIOD_S`; change both together.

`will-change: transform` on the rotating container.

### 5.3 Pointer

A fixed pip at 12 o'clock, layered above the wheel. It carries a subtle ±2.5° tick wobble. A perfectly still pointer over a spinning wheel reads as a broken render.

The tick period is `0.25s`. On a two-slice wheel — the default option count — at a `0.125s` spin period, one slice passes every `0.0625s`, and `0.25s` is exactly four of those, so the wobble stays roughly phase-locked. Other slice counts drift; that is accepted. The wobble is not trying to keep up with the sustained blur, only to stay on its own beat.

### 5.4 Reduced motion

`prefers-reduced-motion` is **intentionally not honored for the wheel**. The spin is the app's entire function; a static wheel would be a blank screen with no explanation. It **is** honored for every incidental motion: the pointer tick, the stop-button press animation, the dodge glide, and the input and button transitions. Note the dodge itself still happens — only the glide is dropped — because it is a behaviour rather than decoration.

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

Default row count on first load: **2**, which is the floor. The list is the user's own work: every row past the second is one they asked for, and a form that opens at two reads as an invitation to build a list rather than a grid of chores to fill in.

Opening *at* the floor has one implementation consequence. The remove control is revealed on row hover rather than being permanently visible — a delete button on every row makes a calm form look destructive — and that hover rule sets `opacity`/`visibility` at a specificity the UA's `[hidden]` rule cannot outrank. Hiding at the floor therefore has to be spelled out with an explicit `.field__remove[hidden] { display: none }`. The floor is not an edge case reached by deliberate removal, it is the first thing every user sees — and a delete button that renders but refuses to delete is worse than no button at all.

### 6.2 Blank handling

On **Spin**, each field's value is trimmed. Any field that is empty after trimming falls back to `Option N` (1-based). The wheel is always complete; spinning with blank fields is allowed.

### 6.3 Defeating form restoration

Two defenses, both required:

1. `autocomplete="off"` on the `<form>` element **and** on every `<input>`.
2. A reset on the `pageshow` event (fresh loads and bfcache restores): all fields cleared and row count restored to the default **2**.

Neither alone is reliable across browsers.

The row count is part of the wipe, not incidental to it. The rows the user added *are* effort they invested, so a reload that kept eleven blank fields would leave the shape of their list behind. They come back to two empty boxes.

### 6.4 Sound

**Mute** toggles a Web Audio synthesised tick on slice passage. Created only inside the Spin submit handler (autoplay policy). No audio files, no runtime npm dependency. If Web Audio is unavailable, the mute control is hidden and ticking is a no-op.

The tick is driven off the wheel's measured angle rather than a timer, so it stays locked to what the user can see even while stage 1 is accelerating, and it is capped at **24 ticks/second**. The cap is not only a spin-up guard: stage 2 sustains 8 rev/s, so boundaries arrive at `8 × sliceCount` per second — 16/s at the two-slice default, which passes through untouched, but 96/s at twelve slices. Above the cap the ticker stops being one-click-per-slice and *truncates*, dropping whichever boundaries fall inside a closed window, so the surviving clicks are an arrhythmic rattle rather than an evenly thinned one. That is the intended behaviour at a speed nothing could click cleanly at: a rattle reads as a wheel going far too fast, which is the joke. Per-slice accuracy is not claimed above the cap.

It is the **only control in the spinning phase that does what it says**, which is its own joke. It is a **fixed** utility anchored to the top-right of the viewport at a **44×44px** touch target, mounted as a direct child of `#spin-panel` rather than nested in the controls column, for three reasons:

- **44px is the floor for a touch target**, and anything smaller is a control that only works for people with a mouse. The glyph inside scales with it, to 20px, or a 44px box around a 17px icon reads as an empty square with something small lost in the middle. At that size the button is no longer small enough to pass as a footnote stacked under the stop button, so it goes where utilities go: a corner.
- **It must not be catchable by accident.** The row it would otherwise occupy sits squarely inside the region the stop button dodges through. The one control that works must never be reachable by a stray swipe at the one that refuses to be.
- **`position: fixed` is load-bearing, not cosmetic.** Fixed elements are out of flow and contribute nothing to the document's scroll height, which is exactly what the "fits in one viewport at 375×667" assertion in §8 measures. An absolutely positioned button inside a relatively positioned ancestor would satisfy the visual placement and break that fit.

It carries `z-index: 3`, above both the wheel (`1`) and the controls cluster (`2`), so nothing can ever cover it.

There is deliberately **no readout panel** — no rate, elapsed, confidence or countdown. An earlier revision had one; it competed with the wheel for attention and shrank it. The wheel is the whole screen.

### 6.5 Fake stop button

Label: **STOP THE WHEEL**. Clicking it updates a taunt line and plays a brief press/shake animation on the button, so it feels genuinely wired up. It never touches the wheel.

**It also flees the cursor.** On a mouse pointer within **110px** of the button's edge, it hops **132px** directly away, gliding over 240ms.

The button's slot is **capped at `min(100%, 280px)`**, well under the wheel's width. Two things bind here. A button as wide as the stage reads as a banner rather than as a thing to chase; and at 375px an uncapped one runs edge to edge, leaving no gutter for it to dodge sideways into — the horizontal half of the dodge would silently stop existing on exactly the viewport where it is most conspicuous. The width also feeds the dodge's tie-break: a wide button approached from directly below has an away-vector that is almost purely vertical, so below a fifth of its half-width the horizontal component is treated as no preference and broken by cursor side instead.

Constraints on the dodge:

- **Clamped to the viewport**, keeping a 12px margin. It must never leave the screen and must never lengthen the document into a scrollbar.
- **Catchable.** Because the offset is clamped, a button driven into a corner has nowhere left to go and can be clicked. That is intended: the taunts are the reward for cornering it, and an uncatchable button is a dead end rather than a joke.
- **Clickable wherever it lands.** The jump is 132px and clamped only by the viewport, so on a phone the button routinely comes to rest *over* the wheel. The controls cluster therefore carries `position: relative; z-index: 2`, above the wheel's `z-index: 1`. Left in the default stacking order the button would slide behind the spinning disc and stop taking clicks there — which would turn the corner-catch payoff into a dead end by another route.
- **Mouse only** (`pointerType === 'mouse'`). Coarse pointers do not hover, so on a phone the only pointer events arrive mid-tap; dodging then reads as a broken button. Keyboard access via Tab and Enter is untouched.
- Honored under `prefers-reduced-motion` as a **behaviour**, not decoration: it still dodges, but cuts to the new position instead of gliding.
- The offset lives on a wrapping **`.stop-slot`**, never on the button itself, because the press shake animates the same property and an animation beats an inline style — a shake would otherwise snap the button back to its undodged position mid-flight.
- The slot is **transformed, never repositioned**, so it keeps its place in layout and a fleeing button never reflows the taunt beneath it.

The rest position must be **cached**, not re-measured per event. The slot glides for 240ms, so a live client rect read during the glide reports a partial position; deriving the untransformed origin from it yields a stale value and the clamp lets the button walk off the screen.

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
| `<title>` and `<h1>` | `Normal Spin The Wheel` |
| Eyebrow (setup) | `Decision tool` |
| Subtitle (setup) | `Enter your options. Let the wheel decide.` |
| Spin button | `Spin` |
| Add option | `Add option` |
| Stop button | `STOP THE WHEEL` |
| Taunt line (initial) | *(empty)* |

The subtitle is played completely straight. No winking.

The `<title>` and the `<h1>` must **match, and both must be innocuous**. "Infinite Spin Trap" is the name of the project, never a string the user sees: the tab title is on screen before the first option is typed, and it also lands in bookmarks and history.

---

## 8. Responsive

| Viewport | Layout |
|---|---|
| ≥ 560px | Inputs in a 2-column grid |
| < 560px | Inputs in a single column |

The wheel is sized `min(106%, 72vh, 640px)` with `aspect-ratio: 1`, against a full-bleed stage that cancels the app's horizontal padding. It is a percentage rather than `vw` so the sizing never counts a scrollbar. In practice `72vh` binds on a desktop window and `106%` binds on a phone; `640px` matches `.app`'s own max-width and therefore never binds on its own.

**The first term is `106%`, not `100%`, because the box is not the artwork.** Only the inscribed circle is painted — rim `r=181` of a `400` viewBox, so `--wheel-art` is 90.5% of the box — and `.stage__clip` (below) already throws the empty swept corners away. Letting the *box* overhang the bled width by 3% a side therefore grows the *painted circle* for free, without ever painting outside the viewport: at 375px the box is 397px and the painted circle 359px, against 339px if the box were capped at `100%`, and there is still ~7.9px of clearance on each side. **Do not push this past ~108%**: beyond that the circle itself starts being clipped, which is a visible defect rather than a free win. The guard that catches that is the painted-diameter assertion in `e2e/responsive.spec.ts`, not the horizontal-scroll one — the corners are clipped either way, so the document never widens to tell you.

The height cap is the desktop half of the same argument: `72vh` puts a 576px box, and a 521px painted circle, on a 1280×800 window. The wheel is the hero of the screen in both orientations, and `e2e/responsive.spec.ts` asserts a floor of 55% of the viewport width against the cheap fix of shrinking it until nothing can overflow.

A square rotating about its centre sweeps a circle of `side × √2`, so a wheel sized to fit statically still pushes its corners past the viewport as it turns — sizing it naively at `min(88vw, 420px)` gave a 418px-wide document at 375px wide whenever a corner faced the edge.

The fix is to **clip the swept corners**, not to shrink the wheel. `.stage__clip` wraps the wheel with `overflow: clip`, which suppresses the overflow without creating a scroll container. This costs nothing visible: the artwork is a circle inscribed in the box (rim `r=181` of a `400` viewBox, so 90.5% of the box) and the four corners it sweeps through are empty.

An earlier revision instead divided the size by √2, which surrendered ~30% of the available width to reserve room for those empty corners. Clipping recovers it — against today's caps that division would give a 407px box on a 1280×800 desktop and a 281px box at 375×667, where clipping gives 576px and 397px.

Two things this depends on:

- **The pointer must stay outside `.stage__clip`.** It overhangs the top edge on purpose and would otherwise be beheaded.
- **`.stage__clip` must not use `align-items: stretch`** (the flex default) and `.wheel` must be `flex: none`. The wheel is square by `aspect-ratio`, so a stretched cross-axis height feeds straight back into its width and it blows past the `--wheel-w` cap entirely.

When measuring the wheel, use `offsetWidth`. It is mid-rotation, so `getBoundingClientRect()` reports the **swept** bounding box — up to 41% wider than the wheel — which is exactly the region being clipped away.

`overflow-x: hidden` is not an acceptable substitute for any of this. It hides the symptom and leaves the over-wide element in place.

**At 375×667 (iPhone SE), the spinning view must fit in one viewport with no scrolling** — wheel, pointer, stop button, and taunt line all visible at once. The page must never scroll horizontally in either phase.

**Width, not height, is what binds at 375px.** With the wheel at its `106%` cap the spinning view still leaves roughly 80px of vertical slack, so the constraint that decides how large the wheel can be is the horizontal clearance measured above, not the stack below it. Anything that spends that vertical slack — a taller control, a second row, an element that reintroduces flow height where `position: fixed` avoided it (see §6.4) — is spending the only margin the fit assertion has.

---

## 9. Architecture

No runtime dependencies. Vite + vanilla TypeScript, strict mode.

| File | Responsibility |
|---|---|
| `index.html` | App shell and mount points |
| `src/main.ts` | Entry point — calls `initApp(document)`, nothing else |
| `src/app.ts` | State, wiring, phase switch, spin handoff, mute mount, stop-button handler and dodge |
| `src/form.ts` | `renderSetupPanel(host)`, `readLabels(root)`, `clearFields(root)` — input generation, blank fallback, reload wipe |
| `src/wheel.ts` | `buildWheel(labels: string[]): SVGSVGElement` — pure geometry, no app state |
| `src/taunts.ts` | `tauntFor(clickCount: number): string` — pure |
| `src/sound.ts` | `createTicker(view)` — synthesised Web Audio tick, mute, no-op fallback |
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

- The wheel is still rotating at t≈8s (sample `getComputedStyle(...).transform` at two times, assert the matrix changed). Any third confirming sample must be offset by a *non*-multiple of the 0.125s spin period — 60ms is ~173°, about as far from a repeat as the wheel ever gets — or a coincidental match reads as "stopped".
- `animation-iteration-count` resolves to `infinite`.
- Reload and bfcache restore leave all inputs empty.
- No `beforeunload` dialog appears on navigation away.
- No horizontal scroll at 375×667, and the painted circle stays inside the viewport on both axes.

Because the form opens at its two-row floor, an E2E spec that wants a wheel worth looking at has to grow the list before it can type into it. That dance lives once, in **`e2e/helpers.ts`** (`TYPED`, `fillOptions`), and is shared by every spec that needs a filled form. `fillOptions` reads the current row count rather than assuming it, and adds rows one at a time waiting for each to land — the list is rebuilt from scratch on every add, so clicking blind races the re-render. Specs that assert on the default count itself must state it literally rather than going through the helper.

---

## 11. Acceptance checklist

1. `npm run typecheck` — clean under `strict`.
2. `npm test` — all unit and jsdom tests pass, none skipped.
3. `npm run e2e` — all Playwright tests pass.
4. `npm run build && npm run preview` — production bundle behaves identically to dev.
5. The form opens at 2 rows with **Add option** available and **remove** hidden; grown to 8 distinct options, all 8 render on the correct slices with every label inside the rim.
6. Spin-up accelerates continuously into a constant rate with **no perceptible lurch at the 6s handoff**, and never eases back down on the way there.
7. Still spinning at a constant 8 rev/s after several minutes — no drift, no restart.
8. A 24-character option truncates cleanly rather than spilling off the wheel.
9. Blank fields render as `Option N`.
10. **STOP THE WHEEL** advances taunts to `No.` and stays there; wheel unaffected, and the button still takes clicks where it lands over the wheel.
11. Reload wipes every input **and returns the list to 2 rows**. `grep -ri "localstorage\|sessionstorage\|cookie\|indexeddb" src/` returns nothing.
12. While spinning: browser back, reload, `Esc`, and tab close all work with no prompt and no block.
13. At 375×667 the form is one column, the spinning view fits without scrolling, and the painted circle clears both side edges.
