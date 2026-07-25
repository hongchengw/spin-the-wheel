# Task Overview

This folder holds the implementation plan for **Infinite Spin Trap**, split into one file per step.

`../SPEC.md` is the single source of truth. These task files are execution slices derived from it. If a task file and `SPEC.md` disagree, `SPEC.md` is correct.

## Execution convention

Each numbered task is executed by a **fresh agent on the Opus 5 model**, given **only that task's markdown file** as context. The agent does not read `SPEC.md`, the other task files, or this overview.

That is why every task file is written to be self-contained: it inlines the constants, math, copy strings, DOM ids, and prerequisite file state that its agent needs. Redundancy between task files is deliberate, not accidental.

Tasks run **sequentially**. Each one's done-criteria are verified before the next agent is launched.

## Test-first

Every implementation task follows the same internal order:

1. Write the listed test cases.
2. Run them and confirm they **fail for the right reason** — a missing module or a wrong value, not a syntax error in the test itself.
3. Implement the minimum needed to pass.
4. Run the full suite; new tests pass and every earlier task's tests still pass.

No task is complete with a failing or skipped test.

## Order

| # | File | Scope |
|---|---|---|
| 01 | `01-scaffold.md` | Vite + TypeScript project skeleton, `index.html`, base CSS |
| 02 | `02-test-harness.md` | Vitest (jsdom) + Playwright, smoke tests both layers |
| 03 | `03-wheel-geometry.md` | `src/wheel.ts` — pure SVG geometry |
| 04 | `04-input-form.md` | 8 inputs, blank fallback, defeat form restoration |
| 05 | `05-phase-switch.md` | One-way `setup → spinning`, setup panel removed from DOM |
| 06 | `06-spin-animation.md` | Two-stage infinite spin, pointer tick |
| 07 | `07-fake-stop.md` | `src/taunts.ts` + fake STOP THE WHEEL button |
| 08 | `08-polish-responsive.md` | Theme, type scale, 375×667 mobile |
| 09 | `09-final-verification.md` | Full suite, build, spec drift check |

## Two constraints that appear in every task file

1. **The trap is social, not technical.** No `beforeunload`, no history trapping, no fullscreen/pointer lock, no focus traps, no blocking of browser shortcuts. Browser back, reload, `Esc`, and tab close always work normally. The app only omits an *in-app* exit.
2. **No persistence.** No `localStorage`, `sessionStorage`, cookies, IndexedDB, URL state, or network calls. Reload must destroy all user input — that is the punchline.
