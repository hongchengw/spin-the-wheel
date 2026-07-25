# Task 05 — Phase switch

## Your context

You are working on a web app called **Infinite Spin Trap**. This file is your complete context — you have not seen the project spec or any other task file, and you should not assume anything not written here.

Working directory: `C:\Users\hongc\OneDrive\Projects\spinthewheelahh\spin-the-wheel` (Windows).

## Prerequisite state

Previous tasks built the project skeleton, test harness, wheel geometry, and the setup form. The repo has:

```
package.json        scripts: dev / build / preview / typecheck / test / test:watch / e2e
tsconfig.json       strict: true; includes src, tests, e2e
vite.config.ts      Vite + Vitest (environment: 'jsdom', include: ['tests/**/*.test.ts'])
playwright.config.ts   projects: 'chromium' (desktop) and 'mobile' (375x667)
index.html          shell (below)
src/main.ts         imports './style.css'; renders the setup panel; clears fields on 'pageshow'
src/form.ts         renderSetupPanel(host), readLabels(root), clearFields(root)   — do not modify
src/wheel.ts        buildWheel(labels: string[]): SVGSVGElement                    — do not modify
src/style.css       reset + theme custom properties (--bg, --surface, --text, --muted, --accent, --slice-1…8)
tests/smoke.test.ts, tests/wheel.test.ts, tests/form.test.ts
e2e/*.spec.ts
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
  <script type="module" src="/src/main.ts"></script>
</body>
```

Existing API you will call:

- `renderSetupPanel(host: HTMLElement): void` — renders a `<form id="options-form">` with inputs `#opt-1` … `#opt-8` and a `<button type="submit" id="spin-btn">Spin</button>`.
- `readLabels(root: ParentNode): string[]` — returns exactly 8 trimmed strings, with blank fields falling back to `Option N`.
- `buildWheel(labels: string[]): SVGSVGElement` — returns a detached `<svg viewBox="0 0 400 400">` with 8 labeled slices. Throws if not given exactly 8 labels.

## What the app does

The user fills 8 text fields with custom options, presses **Spin**, and an SVG prize wheel appears with their options and spins forever. It never stops and never lands on anything.

This task builds the **one-way transition from the setup screen to the spinning screen**, and mounts the wheel. It does **not** build the spin animation (next task) or the fake stop button (task after).

## Goal

On form submit: read the labels, build the wheel, mount it, and switch the app into its spinning phase permanently.

## Spec

### The two phases

Tracked by a class on `<body>`:

| Phase | Body class | Panel shown |
|---|---|---|
| Setup | `setup` | `#setup-panel` |
| Spinning | `spinning` | `#spin-panel` |

The page starts in `setup`. The transition fires **once**, on submit, and is **one-way**.

### On submit

1. `event.preventDefault()` — never let the form navigate.
2. `const labels = readLabels(document)` — or the form element as root.
3. `const svg = buildWheel(labels)`.
4. Populate `#spin-panel` with this structure, then insert `svg` as the child of `.wheel`:

```html
<div class="stage">
  <div class="pointer" aria-hidden="true"></div>
  <div class="wheel" id="wheel"><!-- svg goes here --></div>
</div>
```

The `.wheel` div is the element a later task will rotate — the SVG must be wrapped in it, not mounted bare. The `.pointer` sits **outside** `.wheel` so it stays still while the wheel turns.

5. Remove the `hidden` attribute from `#spin-panel`.
6. **Remove `#setup-panel` from the DOM entirely** — `setupPanel.remove()`. Do not merely hide it, do not set `hidden`, do not `display: none`. It must not be reachable by tabbing, and a curious user must not be able to un-hide it in devtools without reloading.
7. Swap the body class: remove `setup`, add `spinning`.
8. Hide the subtitle (`.subtitle`) in the spinning phase via CSS on `body.spinning` — the instruction to enter options is meaningless once spinning. The `<h1>` stays.

### One-way means one-way

There is **no** in-app route back to setup. Do not add a reset button, a back link, a keyboard shortcut, or a double-click escape hatch. The only ways out are browser-level: reload, back, or closing the tab — and those must all keep working normally.

### Minimal styling

Add just enough CSS for the stage to lay out sensibly — `.stage` as a centered relative container, `.wheel` sized `min(88vw, 420px)` with `aspect-ratio: 1`, the `svg` filling it at `width: 100%; height: 100%; display: block`, and `.pointer` absolutely positioned at top-center above the wheel with a higher `z-index`. A simple CSS triangle (border trick) or a small rotated square is fine for the pointer shape. Full theming and polish come in a later task; do not gold-plate here.

## Tests to write first

### `tests/phase.test.ts` (Vitest + jsdom)

Build a container replicating the `index.html` structure, run your wiring against it, then dispatch a `submit` event on the form. Structure the phase-switch logic so it can be invoked against a supplied root rather than only via module-load side effects on the real `document` — otherwise it is untestable. Export an init function from `src/main.ts` (or a new `src/app.ts`) that takes the root, and have the module's top level simply call it with `document`.

Write these, run them, and confirm they fail. Then implement.

1. **Before submit:** `#setup-panel` exists and contains 8 inputs; `#spin-panel` has the `hidden` attribute; body has class `setup`.
2. **After submit:** body has class `spinning` and no longer has class `setup`.
3. **After submit:** `#spin-panel` no longer has the `hidden` attribute.
4. **After submit:** `#setup-panel` is **gone from the DOM** — `root.querySelector('#setup-panel')` is `null`.
5. **After submit:** there are **zero** `input` elements anywhere in the DOM. This is the real assertion behind "no way back" — it fails if the panel was hidden instead of removed.
6. **After submit:** an `svg` exists inside `#wheel`, and `#wheel` has class `wheel`.
7. **The svg is a child of `.wheel`,** not a sibling — assert `wheel.querySelector('svg')` is non-null and the svg's `parentElement` has class `wheel`.
8. **The pointer is outside the wheel** — `.pointer` exists, and `.wheel` does **not** contain it.
9. **Typed values reach the wheel** — fill the 8 inputs with distinct strings, submit, then assert the svg's `text` contents match those strings in order.
10. **Blank fields reach the wheel as fallbacks** — leave one field empty, submit, assert the corresponding wheel text is `Option N`.
11. **Submitting does not navigate** — assert `preventDefault` was called (e.g. dispatch a cancelable `submit` event and check `event.defaultPrevented` is `true`).

### `e2e/phase.spec.ts` (Playwright)

12. **Full journey:** fill 8 distinct options, click `#spin-btn`, assert the wheel svg is visible and the 8 labels appear on it.
13. **No inputs remain** after spinning starts — `page.locator('input')` has count 0.
14. **No dialog on navigation.** Register a `page.on('dialog', ...)` handler that fails the test if fired, then `page.reload()` and `page.goBack()`. Assert no dialog appeared. This locks in that no `beforeunload` handler was ever added.

## Constraints

1. **The trap is social, not technical.** Never add `beforeunload`, history/back-button trapping, fullscreen or pointer lock, focus traps, or anything blocking browser shortcuts. Browser back, reload, `Esc`, and tab close must always work normally at every moment. The app only omits an *in-app* exit.
2. **No persistence.** No `localStorage`, `sessionStorage`, cookies, IndexedDB, URL state, or network calls. Reload must destroy all user input.
3. **No runtime dependencies.**
4. Do not modify `src/wheel.ts`, `src/form.ts`, or their tests.
5. Do not implement the spin animation or the stop button — later tasks own those.

## Done criteria

Run each and report the actual output:

1. Before implementing: `npm test` shows the new `tests/phase.test.ts` cases **failing**. Report that you confirmed this, and that they fail for the right reason.
2. `npm run typecheck` — exits 0.
3. `npm test` — all tests pass, including the earlier smoke, wheel, and form tests. Report the pass count; none may be skipped.
4. `npm run e2e` — all Playwright tests pass on both the `chromium` and `mobile` projects.
5. `npm run build` — succeeds.
6. `npm run dev`, then manually: type 8 options, click **Spin**, and confirm the wheel appears with your text and the form is gone. The wheel will be static — that is expected at this stage. Stop the server afterward.
