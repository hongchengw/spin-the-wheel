# Task 02 — Test harness

## Your context

You are working on a web app called **Infinite Spin Trap**. This file is your complete context — you have not seen the project spec or any other task file, and you should not assume anything not written here.

Working directory: `C:\Users\hongc\OneDrive\Projects\spinthewheelahh\spin-the-wheel` (Windows).

## Prerequisite state

A previous task created a working Vite + TypeScript skeleton. The repo has:

```
package.json        scripts: dev / build / preview / typecheck. devDeps: vite, typescript. No runtime deps.
tsconfig.json       strict: true, target ES2020, moduleResolution bundler, noEmit, include: ["src"]
vite.config.ts      defineConfig with base: './'
index.html          shell with <body class="setup">, #setup-panel, #spin-panel
src/main.ts         near-empty entry, imports './style.css'
src/style.css       reset + theme custom properties
SPEC.md, README.md, .gitignore, tasks/
```

`node_modules/` exists (`npm install` has been run). Read `package.json` and `tsconfig.json` before editing them.

## What the app will eventually do

Context so your test setup makes sense — you are **not** testing this behavior yet, it does not exist:

The user fills 8 text fields with custom options, presses **Spin**, and an SVG prize wheel appears with their options and spins. It never stops. A **STOP THE WHEEL** button does nothing but show taunting messages. Reloading the page wipes all inputs — nothing is persisted.

Later tasks will add unit tests for pure geometry and taunt functions, jsdom tests for form behavior, and Playwright tests for the spin animation, reload-wipes-inputs behavior, and mobile layout.

## Goal

Stand up both test layers so later tasks can write tests immediately. Prove each layer works with one deliberate smoke test.

## Why two layers

Vitest with jsdom covers pure logic and DOM construction — fast, no browser. But several critical properties are **only** observable in a real browser and must be Playwright:

- whether a CSS animation is still running after N seconds
- whether `animation-iteration-count` resolves to `infinite`
- whether a page reload leaves form inputs empty (browsers restore form state)
- whether the page scrolls horizontally at a given viewport

Do not try to cover those in jsdom; it will produce tests that pass while the app is broken.

## Work

### Dependencies

Add as devDependencies: `vitest`, `jsdom`, `@playwright/test`.

After installing `@playwright/test`, run `npx playwright install chromium` to fetch the browser binary.

### Scripts in `package.json`

Add, keeping the existing ones:

- `"test": "vitest run"`
- `"test:watch": "vitest"`
- `"e2e": "playwright test"`

### Vitest config

Configure Vitest inside `vite.config.ts` (add a `test` block; you will need the `/// <reference types="vitest" />` triple-slash directive at the top of the file, or import `defineConfig` from `vitest/config` instead of `vite`).

- `environment: 'jsdom'`
- `include: ['tests/**/*.test.ts']`
- Ensure the `e2e/` folder is **not** picked up by Vitest — Playwright specs and Vitest specs must not collide. Keeping Vitest's `include` scoped to `tests/**` handles this, but verify it.

### tsconfig

`tsconfig.json` currently has `"include": ["src"]`, so test files would not be typechecked. Extend `include` to cover `tests` and `e2e` as well. Make sure `npm run typecheck` still passes afterward — you may need to add Vitest's globals or import `describe`/`it`/`expect` explicitly from `vitest` (prefer explicit imports over globals; it keeps the config simpler).

### Playwright config — `playwright.config.ts`

- `testDir: './e2e'`
- `webServer`: run `npm run preview` against the built app, with `url` pointing at the preview server's address and `reuseExistingServer: !process.env.CI`. Note the preview server needs a build to exist first — set the webServer `command` to build then preview (e.g. `npm run build && npm run preview`) so `npm run e2e` works from a clean checkout.
- `use: { baseURL: <the preview URL> }`
- Two projects:
  - `chromium` — desktop, default viewport
  - `mobile` — chromium with `viewport: { width: 375, height: 667 }`
- Set a sensible `timeout`. Some later tests deliberately wait ~10 seconds to confirm the wheel is still spinning, so do not set a per-test timeout below ~30s.

### Smoke tests

Write one per layer. These exist to prove the harness runs, and they must assert something real — not `expect(true).toBe(true)`.

**`tests/smoke.test.ts`** (Vitest + jsdom): assert that the jsdom environment is present and usable, e.g. create a `<div>` via `document.createElement`, set its `textContent`, append it to `document.body`, and assert it is queryable via `document.querySelector` with the expected text. This proves `environment: 'jsdom'` is actually in effect.

**`e2e/smoke.spec.ts`** (Playwright): navigate to `/` and assert the `<h1>` has the text `Infinite Spin Trap`. This proves the webServer, build, and baseURL wiring all work.

### Test-first discipline

Before implementing, write each smoke test and run it. The Vitest one should fail if you point it at something that does not exist; the Playwright one should fail before the config is correct. Confirm failures are for the **right reason** — a missing config or wrong value, not a syntax error in the test. Then make them pass.

## Constraints

1. **The trap is social, not technical.** Never add `beforeunload`, history/back-button trapping, fullscreen or pointer lock, focus traps, or anything blocking browser shortcuts.
2. **No persistence** anywhere in app code: no `localStorage`, `sessionStorage`, cookies, IndexedDB, URL state, or network calls.
3. **No runtime dependencies.** Everything you add is a devDependency.

## Done criteria

Run each and report the actual output:

1. `npm install` — clean.
2. `npx playwright install chromium` — browser downloaded.
3. `npm run typecheck` — exits 0, covering `src`, `tests`, and `e2e`.
4. `npm test` — the jsdom smoke test passes. Report the pass count.
5. `npm run e2e` — the Playwright smoke test passes on **both** the `chromium` and `mobile` projects. Report the pass count.
6. `npm run build` — still succeeds.

Do not report this task complete with any failing or skipped test.
