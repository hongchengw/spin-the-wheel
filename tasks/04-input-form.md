# Task 04 — Input form

## Your context

You are working on a web app called **Infinite Spin Trap**. This file is your complete context — you have not seen the project spec or any other task file, and you should not assume anything not written here.

Working directory: `C:\Users\hongc\OneDrive\Projects\spinthewheelahh\spin-the-wheel` (Windows).

## Prerequisite state

Previous tasks set up a Vite + TypeScript project, a test harness, and the wheel geometry module. The repo has:

```
package.json        scripts: dev / build / preview / typecheck / test / test:watch / e2e
                    devDeps: vite, typescript, vitest, jsdom, @playwright/test. No runtime deps.
tsconfig.json       strict: true, ES2020, moduleResolution bundler, noEmit; includes src, tests, e2e
vite.config.ts      Vite + Vitest config (environment: 'jsdom', include: ['tests/**/*.test.ts'])
playwright.config.ts   projects: 'chromium' (desktop) and 'mobile' (375x667)
index.html          shell (below)
src/main.ts         near-empty entry, imports './style.css'
src/wheel.ts        exports buildWheel(labels: string[]): SVGSVGElement  — do not modify
src/style.css       reset + theme custom properties
tests/smoke.test.ts, tests/wheel.test.ts
e2e/smoke.spec.ts
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

Vitest runs with `environment: 'jsdom'`. Import `describe` / `it` / `expect` / `beforeEach` explicitly from `vitest`.

## What the app does

The user fills 8 text fields with custom options, presses **Spin**, and an SVG prize wheel appears with their options and spins forever. Reloading the page must wipe every input — that is the punchline of the joke, so it is a functional requirement, not a nicety.

This task builds **only the setup form**. Do not build the wheel display, the spin transition, or any animation — later tasks handle those.

## Goal

Create `src/form.ts` exporting:

```ts
export function renderSetupPanel(host: HTMLElement): void
export function readLabels(host: ParentNode): string[]
```

and wire `renderSetupPanel` into `src/main.ts` against `#setup-panel`.

## Spec

### Markup produced by `renderSetupPanel`

Into the host element, render a `<form>` with `id="options-form"` and `autocomplete="off"`, containing:

- Eight field groups. For `n` in 1…8:
  - `<label for="opt-n">Option n</label>`
  - `<input type="text" id="opt-n" name="opt-n" placeholder="Option n" maxlength="24" autocomplete="off">`
- A submit button: `<button type="submit" id="spin-btn">Spin</button>`

The button is a real `type="submit"` inside a real `<form>`, so Enter in any field submits — that is the natural behavior a sincere app would have, and the app must feel sincere.

`renderSetupPanel` replaces the host's contents; calling it twice must not produce 16 inputs.

### `readLabels`

Reads `#opt-1` … `#opt-8` from the given root, trims each value, and returns 8 strings. **Any field that is empty after trimming falls back to `Option N`** (1-based). The wheel is always complete — submitting a fully blank form is allowed and yields `Option 1` … `Option 8`.

Take the root as a parameter rather than reaching for `document` directly, so it can be tested against a detached container.

### Defeating form restoration

Browsers restore form field values on soft reload via form-state restoration and the back-forward cache. This would preserve the user's typing across a reload and **kill the joke**. Two defenses, both required — neither is reliable alone:

1. `autocomplete="off"` on the `<form>` **and** on every `<input>` (covered above).
2. In `src/main.ts`, a listener on the `pageshow` event that clears all 8 fields. `pageshow` fires on fresh loads and on bfcache restores, which is why it is used instead of `load`.

Export the clear step as a named function from `src/form.ts` (e.g. `clearFields(host: ParentNode): void`) so it can be unit-tested directly.

### What is explicitly forbidden

No `localStorage`, `sessionStorage`, cookies, IndexedDB, URL query params, hash state, or network calls — anywhere. Nothing the user types may survive a reload by any mechanism.

## Tests to write first — `tests/form.test.ts`

Write these, run them, and confirm they fail because `src/form.ts` does not exist yet. Then implement until they pass.

Set up each test by creating a detached `<div>` (or one appended to `document.body` and cleared in `beforeEach`) and calling `renderSetupPanel` on it.

1. **Renders exactly 8 text inputs.**
2. **Input ids are `opt-1` … `opt-8`,** in that order.
3. **Every input has `autocomplete="off"`** and `maxlength="24"`.
4. **The form itself has `autocomplete="off"`** and `id="options-form"`.
5. **Placeholders are `Option 1` … `Option 8`.**
6. **Each input has an associated label** whose `for` matches the input's `id`.
7. **A submit button exists** with `id="spin-btn"`, `type="submit"`, and text `Spin`.
8. **`renderSetupPanel` is idempotent** — calling it twice on the same host still yields exactly 8 inputs.
9. **`readLabels` returns typed values** — fill all 8 with distinct strings, assert the exact array comes back.
10. **`readLabels` trims whitespace** — `'  Pizza  '` comes back as `'Pizza'`.
11. **`readLabels` falls back for blank fields** — leave fields 2 and 5 empty, assert those slots are `'Option 2'` and `'Option 5'` while the others keep their typed values.
12. **`readLabels` falls back for whitespace-only fields** — a field containing `'   '` becomes `Option N`, not `''`.
13. **`readLabels` on a fully blank form** returns `['Option 1', …, 'Option 8']`.
14. **`readLabels` always returns exactly 8 items.**
15. **`clearFields` empties every input** — fill all 8, call it, assert all values are `''`.

## E2E test to add — append to `e2e/smoke.spec.ts` or a new `e2e/form.spec.ts`

The reload behavior cannot be verified in jsdom; it needs a real browser.

16. **Reload wipes inputs.** Navigate to `/`, fill all 8 inputs with distinct text, call `page.reload()`, then assert all 8 inputs have value `''`. This is the test that proves the punchline works.

## Implementation notes

- `renderSetupPanel` should build nodes with `document.createElement` and `append`, not `innerHTML` string concatenation — user-typed content never round-trips through markup that way.
- In `src/main.ts`, guard the `#setup-panel` lookup: `document.querySelector` returns `T | null` and `strict` will reject an unchecked use. Throw a clear error if the element is missing.
- Register the `pageshow` listener in `src/main.ts`, not inside `form.ts` — keep `form.ts` free of global side effects so it stays testable.

## Constraints

1. **The trap is social, not technical.** Never add `beforeunload`, history/back-button trapping, fullscreen or pointer lock, focus traps, or anything blocking browser shortcuts. Browser back, reload, `Esc`, and tab close must always work normally.
2. **No persistence**, by any mechanism (see above).
3. **No runtime dependencies.**
4. Do not modify `src/wheel.ts`, `tests/wheel.test.ts`, or `playwright.config.ts`.
5. Do not implement the spin transition or wheel rendering — a later task does that. The **Spin** button may submit and do nothing yet, but you must call `event.preventDefault()` on submit so the page does not navigate.

## Done criteria

Run each and report the actual output:

1. Before implementing: `npm test` shows the new `tests/form.test.ts` cases **failing** because `src/form.ts` is missing. Report that you confirmed this.
2. `npm run typecheck` — exits 0.
3. `npm test` — all tests pass, including the earlier smoke and wheel tests. Report the pass count; none may be skipped.
4. `npm run e2e` — all Playwright tests pass on both projects, including the new reload-wipes-inputs test.
5. `npm run build` — succeeds.
6. `grep -ri "localstorage\|sessionstorage\|cookie\|indexeddb" src/` — returns nothing. Report the result.
