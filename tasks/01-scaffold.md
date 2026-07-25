# Task 01 — Project scaffold

## Your context

You are building a web app called **Infinite Spin Trap**. This file is your complete context — you have not seen the project spec or any other task file, and you should not assume anything not written here.

Working directory: `C:\Users\hongc\OneDrive\Projects\spinthewheelahh\spin-the-wheel` (Windows).

## Prerequisite state

The repo currently contains only:

- `README.md` — a few lines of prose
- `SPEC.md` — the project spec (do not edit)
- `.gitignore` — already correctly configured for a Node/Vite/Playwright project; **do not modify it**
- `tasks/` — this folder

There is **no** `package.json`, `node_modules/`, or `src/` yet. You are creating the project from nothing.

## What the app will eventually do

Context so your scaffold makes sense — you are **not** building this behavior in this task:

The user fills in 8 text fields with custom options, presses **Spin**, and an SVG prize wheel appears with their options and starts spinning. It never stops. A **STOP THE WHEEL** button does nothing. Reloading wipes all inputs.

## Goal

Produce a working Vite + TypeScript skeleton that serves a styled, empty page. No app logic, no wheel, no form — those come in later tasks.

## Files to create

### `package.json`

- `"name": "infinite-spin-trap"`, `"private": true`, `"type": "module"`, `"version": "0.0.0"`
- devDependencies only: `vite` and `typescript`. **No runtime dependencies** — this app ships zero.
- Scripts:
  - `"dev": "vite"`
  - `"build": "tsc --noEmit && vite build"`
  - `"preview": "vite preview"`
  - `"typecheck": "tsc --noEmit"`

### `tsconfig.json`

- `"strict": true`
- `"target": "ES2020"`, `"lib": ["ES2020", "DOM", "DOM.Iterable"]`
- `"module": "ESNext"`, `"moduleResolution": "bundler"`
- `"noEmit": true`, `"isolatedModules": true`, `"skipLibCheck": true`
- Also enable `"noUnusedLocals"`, `"noUnusedParameters"`, `"noFallthroughCasesInSwitch"`
- `"include": ["src"]`

### `vite.config.ts`

Minimal, with `base: './'` so the built output works from any static host or opened path. Import `defineConfig` from `vite`.

### `index.html`

The app shell. Exact structure required — later tasks depend on these ids and classes existing:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Infinite Spin Trap</title>
  </head>
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
</html>
```

Both panels are left empty — later tasks populate them from JS.

### `src/main.ts`

A near-empty entry point for now. It must import the stylesheet so Vite includes it:

```ts
import './style.css';
```

Plus a single line of setup that proves the bundle runs — e.g. querying `#setup-panel` and confirming it exists, throwing a clear error if not. Keep it under ~10 lines. It must typecheck under `strict` (note that `document.querySelector` returns `T | null`).

### `src/style.css`

Base layer only — no component styles yet.

- A small CSS reset: `*, *::before, *::after { box-sizing: border-box; }`, zero default margin, `body { min-height: 100vh; }`
- Custom properties on `:root` for the theme:
  - `--bg: #12131a`
  - `--surface: #1c1e29`
  - `--text: #f2f3f7`
  - `--muted: #9aa0b4`
  - `--accent: #ffc94d`
  - The 8 wheel slice colors, alternating warm and cool so adjacent slices always contrast:
    `--slice-1: #e5484d`, `--slice-2: #2f6feb`, `--slice-3: #f5a524`, `--slice-4: #12a594`,
    `--slice-5: #d6409f`, `--slice-6: #5b5bd6`, `--slice-7: #f76b15`, `--slice-8: #46a758`
- `body` uses `--bg` / `--text`, a system font stack, and centers `.app` with flex
- `.app` gets a `max-width` around `720px`, horizontal auto margins, and some padding
- Basic `.title` / `.subtitle` styling. `.subtitle` uses `--muted`.
- `html, body { overflow-x: hidden; }` is **not** an acceptable fix for layout problems — do not add it. Layout must simply not overflow.

## Constraints

These apply to this task and every later one:

1. **The trap is social, not technical.** Never add `beforeunload`, history/back-button trapping, fullscreen or pointer lock, focus traps, or anything blocking browser shortcuts. Browser back, reload, `Esc`, and tab close must always work normally.
2. **No persistence.** Never use `localStorage`, `sessionStorage`, cookies, IndexedDB, URL state, or network calls.
3. **No runtime dependencies.** devDependencies only.

## Done criteria

Run each and report the actual output:

1. `npm install` — completes without error.
2. `npm run typecheck` — exits 0 with no diagnostics.
3. `npm run build` — succeeds and produces `dist/`.
4. `npm run dev` — starts and serves. Confirm the page loads with the title and subtitle visible on the dark background and **no console errors**. Stop the server afterward; do not leave it running.

Report the exact command output for each. If any step fails, fix it — do not report the task complete with a failing step.
