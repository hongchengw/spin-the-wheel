# Handoff — Infinite Spin Trap

Everything is built and green. What remains is **task 09, a verification pass**, plus a push and a deploy. Do not add features.

---

## 1. What this project is

A joke web app disguised as a sincere prize-wheel tool.

The user types 8 custom options, presses **Spin**, and a polished SVG wheel appears with their options and spins up convincingly — then never stops, never slows, never lands. A large **STOP THE WHEEL** button does nothing but taunt. When they give up and reload, every input is blank and they start over.

**The comedy depends entirely on the app looking legitimate.** A user who suspects a gag in the first five seconds never invests enough to feel trapped. Visual polish and animation smoothness are functional requirements here, not decoration. Keep that bar.

`SPEC.md` is the single source of truth. If code and spec disagree, the spec wins — unless the implementation clearly made the better call, in which case update the spec and say so.

---

## 2. Current state

**Green across the board**, verified independently of the agents that wrote it:

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm test` | 64 passed (7 files) |
| `npm run e2e` | 50 passed (chromium + mobile) |
| `npm run build` | clean, `dist/` ~12 kB |

Git: `main` is one commit ahead of `origin/main`. **`23f011f chore: add vercel deployment config` is unpushed.** Working tree clean.

```
23f011f  chore: add vercel deployment config          <- UNPUSHED
4fa841d  style: polish theme and make layout responsive   <- origin/main
9e57f28  chore: rename agent instructions to AGENTS.md
4f24942  feat(controls): add fake stop button with escalating taunts
56b2069  feat(spin): add two-stage infinite spin at a readable rate
57935c5  feat(app): add one-way setup to spinning phase switch
8dcce70  feat(form): add option inputs with blank fallback and reload wipe
b3f34a8  feat(wheel): add pure svg wheel geometry builder
```

### Layout

```
SPEC.md              source of truth — geometry, animation derivation, copy, constraints
tasks/00-09          the implementation plan; 01-08 are done, 09 is your job
src/main.ts          entry — calls initApp(document)
src/app.ts           wiring: phase switch, spin handoff, stop-button handler
src/form.ts          renderSetupPanel / readLabels / clearFields
src/wheel.ts         buildWheel(labels) -> SVGSVGElement, pure
src/taunts.ts        tauntFor(clickCount) -> string, pure
src/style.css        theme, layout, keyframes
tests/*.test.ts      Vitest + jsdom — logic and DOM construction
e2e/*.spec.ts        Playwright — animation, reload, layout
vercel.json          framework vite, outputDirectory dist
```

---

## 3. Your job

### Step 1 — Run task 09

Open `tasks/09-final-verification.md` and work its checklist end to end. It covers the automated gates, manual behavior checks, the escape hatches, layout at 375×667, and a `SPEC.md` drift check.

**Two items in that file are stale — it predates the final animation tuning:**

- It says the spin-up handoff is at **~1.5s**. It is now at **2.0s**. Verify the seam there.
- It refers to files that have since been split: wiring lives in `src/app.ts`, not `src/main.ts`.

Report honestly. An accurate failure list is worth far more than a clean-looking report. If something fails, fix it or say plainly that it's broken.

### Step 2 — Push

Only after the suite is green:

```bash
npm run typecheck && npm test && npm run e2e && npm run build
git push origin main
```

Commits use **Conventional Commits, single line, no body**: `type(scope): description`.
Examples from this repo: `feat(wheel): add pure svg wheel geometry builder`, `chore: add vercel deployment config`.

### Step 3 — Deploy to Vercel

`vercel.json` is committed and the production build is verified serving locally (index + both assets return 200). Vercel should need no extra configuration — import the repo and deploy.

Note `vite.config.ts` sets `base: './'`, so assets resolve relatively. That works at the domain root, which is where this deploys. If you ever host it under a sub-path, this is the knob.

---

## 4. Invariants — do not break these

These are the whole point of the app. Several are enforced by tests; all are easy to "helpfully" break.

**The wheel never stops.** No slowdown, no pause, no landing on a winner, no easter egg after N clicks. There is no winner-selection logic and there never will be. A test asserts the transform is still changing at 10s.

**The stop button never works.** It updates a taunt and shakes. It never touches the wheel, never becomes `disabled`, never changes its label. A test captures `wheel.className` across ten clicks and asserts it is unchanged.

**Nothing is persisted.** No `localStorage`, `sessionStorage`, cookies, IndexedDB, URL state, or network calls. Reload wiping the inputs *is* the punchline. Defended two ways — `autocomplete="off"` on the form and every input, plus a `pageshow` handler that clears all fields (covers bfcache restores). Both are needed; neither is reliable alone.

**The trap is social, not technical.** No `beforeunload`, no history/back-button trapping, no fullscreen or pointer lock, no focus traps, no blocking of browser shortcuts. Browser back, reload, `Esc`, and tab close must work normally *at every moment*. The app withholds an *in-app* exit — it never holds the browser hostage. A Playwright test fails if any dialog fires on navigation.

**No way back to setup.** The setup panel is `.remove()`d from the DOM, not hidden, so it can't be tabbed to or un-hidden in devtools. A test asserts zero `input` elements exist once spinning.

**`prefers-reduced-motion` is deliberately not honored for the wheel.** The spin is the app's entire function; a static wheel would be a blank screen with no explanation. It *is* honored for the pointer tick, button shake, and transitions. Do not "fix" this.

**No runtime dependencies.** devDependencies only.

---

## 5. Gotchas already paid for

Four non-obvious things were found the hard way. Don't undo them.

**Animation timing is derived, not chosen.** The numbers are load-bearing:

```
Stage 1: spin-up 2s cubic-bezier(.3, 0, .55, .5) forwards   0 -> 720deg
Stage 2: spin 0.9s linear infinite                          0 -> 360deg  (400 deg/s)
```

The sustained speed was picked *first* (400 °/s, ~1.1 rev/s — fast enough to look real, slow enough that labels stay readable), then stage 1 was shaped to end at exactly that speed. A cubic-bezier ends with slope `(1-y2)/(1-x2)`; `.5/.45 = 1.1111` matches `400/360`. If the two stages don't match, the wheel visibly lurches at the handoff — the one moment that gives the gag away.

An earlier version ran at 1920 °/s. The seam was perfect and the labels were an unreadable blur, which read as a rendering bug. Both properties matter. `e2e/spin.spec.ts` has `SPIN_PERIOD_S`; keep it in sync with the CSS.

**A rotating square sweeps `width × √2`.** The wheel is sized from its *swept* footprint (`min(100%/1.43, 62vh, 440px)`), not its static width. Sizing it naively at `min(88vw, 420px)` pushed the corners past the viewport during rotation and caused horizontal scroll at 375px. If you resize the wheel, account for the diagonal.

**`overflow-x: hidden` is banned as a fix.** It hides the symptom and leaves the layout bug. Find the element that's too wide.

**The SVG must not share the `.wheel` class.** `buildWheel` returns an SVG with `class="wheel__svg"`; the rotating container div is the only `.wheel`. A shared name would match both and rotate the SVG a second time inside its own animated parent.

**Label contrast.** White label text failed against `--slice-3` (#f5a524) and `--slice-7` (#f76b15). Fixed with a dark under-stroke (`paint-order: stroke`) rather than tinting the text, so all eight slices get identical treatment.

---

## 6. Known cosmetic issues — your call

Neither is a bug; both were reported honestly rather than quietly smoothed over.

1. **Desktop setup form leaves a large empty band** below the Spin button on tall viewports. Content is top-parked; only the spinning view is vertically centred.
2. **The demoted title sits close above the pointer** in the spinning view. Fine, but tight on breathing room.

Also inherent to radial text: labels on the left half read upside-down at any instant. That is standard for prize wheels and they rotate through readable orientation continuously. `src/wheel.ts` was deliberately left alone here.
