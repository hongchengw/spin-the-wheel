# Task 09 — Final verification

## Your context

You are verifying a finished web app called **Infinite Spin Trap**. This file is your complete context — you have not seen the other task files, and you should not assume anything not written here.

Working directory: `C:\Users\hongc\OneDrive\Projects\spinthewheelahh\spin-the-wheel` (Windows).

Unlike the earlier tasks, this one is **primarily a verification pass, not a build pass**. Your job is to prove the app meets its spec and to fix or report what does not. Do not add features. Do not refactor working code because you would have written it differently.

## What the app is

A joke web app disguised as a sincere prize-wheel tool.

1. The user lands on a clean page with 8 empty text fields.
2. They invest real effort typing 8 custom options.
3. They press **Spin**.
4. A polished SVG wheel appears with their options and spins up convincingly.
5. It never slows, never stops, never lands on anything.
6. A large **STOP THE WHEEL** button is offered. It does nothing but taunt.
7. They eventually give up and reload.
8. Every input is blank. All that typing is gone.

The comedy depends on the app looking legitimate. Polish and animation smoothness are functional requirements.

## Current state

```
SPEC.md             the project spec — the single source of truth
README.md           short: what it is + how to run
package.json        scripts: dev / build / preview / typecheck / test / test:watch / e2e
tsconfig.json       strict: true; includes src, tests, e2e
vite.config.ts      Vite + Vitest (environment: 'jsdom')
playwright.config.ts   projects: 'chromium' (desktop) and 'mobile' (375x667)
index.html          app shell
src/main.ts         entry point — calls initApp(document)
src/app.ts          wiring, phase switch, spin handoff, stop-button handler
src/form.ts         renderSetupPanel / readLabels / clearFields
src/wheel.ts        buildWheel(labels): SVGSVGElement
src/taunts.ts       tauntFor(clickCount): string
src/style.css       reset, theme, layout, keyframes
tests/*.test.ts     smoke, wheel, form, phase, spin, taunts, stop-button
e2e/*.spec.ts       smoke, form, phase, spin, stop, responsive
tasks/              the implementation plan
```

## Acceptance checklist

Work through every item. For each, report **pass or fail with the evidence** — the command output, or what you observed. Do not mark an item passed without actually running it.

### Automated

1. `npm install` — clean.
2. `npm run typecheck` — exits 0, no diagnostics.
3. `npm test` — all unit and jsdom tests pass. Report the pass count. **No test may be skipped, `.only`'d, or `.todo`'d** — grep for `it.skip`, `describe.skip`, `.only`, and `test.todo` and report what you find.
4. `npm run e2e` — all Playwright tests pass on **both** the `chromium` and `mobile` projects. Report the counts per project.
5. `npm run build` — succeeds and produces `dist/`.
6. `npm run preview` — the production bundle behaves identically to dev. Walk the full journey against the preview build, not just dev.
7. `grep -ri "localstorage\|sessionstorage\|cookie\|indexeddb" src/` — returns nothing.
8. `grep -ri "beforeunload\|requestFullscreen\|requestPointerLock\|pushState\|replaceState" src/` — returns nothing. These are the browser-hostile APIs the app is forbidden from using.

### Manual — behavior

9. **Eight distinct options** render on the correct slices, all text inside the rim.
10. **Spin-up looks real.** It accelerates smoothly from rest with **no perceptible lurch or stutter at the 2.0 second mark**, where the animation hands off from its accelerating stage to its constant-rate stage. Watch this transition several times. This is the single moment most likely to give the gag away — report honestly what you see.
11. **Still spinning after several minutes** at a constant rate — no drift, no slowdown, no restart. Leave it running at least 3 minutes and check back.
12. **A 24-character option truncates** cleanly with an ellipsis rather than spilling off the wheel. (24 is the input `maxlength`.)
13. **Blank fields** render as `Option 1` … `Option 8`. Try a fully blank form too.
14. **STOP THE WHEEL** advances taunts through five escalating messages and then settles permanently on `No.` — clicking 20 more times keeps it at `No.` The wheel's speed is completely unaffected throughout.
15. **Reload wipes every input.** Fill all 8, spin, reload, and confirm all 8 fields are empty. Also try navigating away and pressing **Back** — bfcache restore must also leave them empty.
16. **No in-app exit exists.** Once spinning, confirm there is no reset button, back link, or keyboard shortcut that returns to the setup screen. Confirm there are zero `input` elements in the DOM.

### Manual — the escape hatches must work

The app's trap is deliberately social, not technical. It withholds an *in-app* exit; it must never hold the browser hostage. Verify while the wheel is spinning:

17. **Reload** (F5) works immediately, with no confirmation dialog.
18. **Browser back** works, with no dialog and no history trap — pressing back once actually leaves.
19. **`Esc`** does nothing harmful and is not intercepted.
20. **Closing the tab** works with no "are you sure" prompt.

If any of these is blocked, that is a **bug of the highest priority** — fix it immediately and report what you found.

### Manual — layout

21. At **375×667**, the setup form is a single column.
22. At **375×667**, the spinning view fits in one viewport — wheel, pointer, stop button, and taunt line all visible without scrolling.
23. **No horizontal scrolling** in either phase, at any viewport width you try.
24. At desktop width, inputs are in a 2-column grid.

### Documentation

25. **`SPEC.md` matches shipped behavior.** Read it against what the app actually does. Where they differ, decide which is right:
    - If the code drifted from a deliberate spec decision, fix the code.
    - If the implementation made a better decision and the spec is stale, **update `SPEC.md`** to match reality.
    Either way, report every discrepancy you found and how you resolved it. Do not leave a known mismatch undocumented.
26. **`README.md` is accurate and short.** It should say what the app is and how to run it — nothing more. Confirm the setup commands it lists actually work from a clean checkout. Do not expand it into architecture documentation; that belongs in `SPEC.md`.

## Constraints

1. **Do not weaken or delete tests** to make the checklist pass. A failing test is a finding to report and fix, not an obstacle to remove.
2. **Do not add features.** If you spot something desirable but out of scope, report it as a recommendation instead of building it.
3. **Never make the stop button work.** No slowdown, no pause, no easter egg. It does nothing to the wheel, forever.
4. **Never add** `beforeunload`, history trapping, fullscreen or pointer lock, focus traps, or anything blocking browser shortcuts.
5. **No persistence** — no `localStorage`, `sessionStorage`, cookies, IndexedDB, URL state, or network calls.
6. **No runtime dependencies.**

## Done criteria

Produce a report covering:

- Every checklist item above, marked pass or fail, with the evidence.
- Every fix you made, and why.
- Every `SPEC.md` discrepancy found and how it was resolved.
- Anything still broken or uncertain, stated plainly. **Do not report the app complete if something is failing** — an honest failure list is far more useful than a clean-looking report that papers over a problem.
