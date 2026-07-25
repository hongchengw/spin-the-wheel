/**
 * App wiring: renders the setup form, then performs the one-way switch from
 * the setup phase to the spinning phase.
 *
 * `initApp` takes the root it should operate on so the transition is testable
 * against a synthetic container; `main.ts` simply passes the real `document`.
 */

import { renderSetupPanel, readLabels, clearFields } from './form';
import { buildWheel } from './wheel';
import { tauntFor } from './taunts';

export type AppRoot = Document | HTMLElement;

function documentOf(root: AppRoot): Document {
  return root instanceof Document ? root : root.ownerDocument;
}

function required<E extends Element>(root: AppRoot, selector: string): E {
  const el = root.querySelector<E>(selector);
  if (!el) throw new Error(`Missing ${selector} element`);
  return el;
}

/**
 * Builds the spinning-phase stage. The svg is wrapped in `div.wheel` — that
 * div is what a later task rotates — and `.pointer` deliberately sits outside
 * it so it stays put while the wheel turns.
 */
function buildStage(doc: Document, svg: SVGSVGElement): HTMLElement {
  const stage = doc.createElement('div');
  stage.className = 'stage';

  const pointer = doc.createElement('div');
  pointer.className = 'pointer';
  pointer.setAttribute('aria-hidden', 'true');

  const wheel = doc.createElement('div');
  // `is-spinning-up` starts stage 1 the moment the div lands in the document.
  wheel.className = 'wheel is-spinning-up';
  wheel.id = 'wheel';
  wheel.appendChild(svg);

  stage.append(pointer, wheel);
  return stage;
}

/** Keep in sync with the `stop-press` duration in src/style.css. */
const PRESS_MS = 260;

/**
 * Builds the controls block: the fake stop button and its taunt line.
 *
 * The taunt starts empty on purpose — a pre-filled line would give away that
 * the messages are canned. `role="status"` plus `aria-live="polite"` means a
 * screen reader announces each new line, which is what a sincere app would do
 * and is therefore what this one does.
 */
function buildControls(doc: Document): HTMLElement {
  const controls = doc.createElement('div');
  controls.className = 'controls';

  const button = doc.createElement('button');
  button.type = 'button';
  button.id = 'stop-btn';
  button.className = 'stop-btn';
  button.textContent = 'STOP THE WHEEL';

  const taunt = doc.createElement('p');
  taunt.id = 'taunt';
  taunt.className = 'taunt';
  taunt.setAttribute('role', 'status');
  taunt.setAttribute('aria-live', 'polite');

  controls.append(button, taunt);
  return controls;
}

/**
 * Wires the stop button to do exactly two things: update its own copy and
 * shake itself. It never touches the wheel, never disables itself, never
 * relabels itself and is never removed — the button has to stay credible
 * forever, and a disabled or relabelled button admits the gag.
 *
 * The counter is a closure variable: no storage, no URL state, nothing that
 * survives a reload. Reloading genuinely resets the app, and that remains the
 * real exit at every moment.
 *
 * Restarting the press animation needs care. Re-adding the class in the same
 * frame is a no-op because the style recalc coalesces the removal and the
 * addition, so the animation never sees a change. Reading `offsetWidth`
 * between the two forces a synchronous reflow, which commits the "no
 * animation" state and makes the re-add a genuine restart. `animationend`
 * then clears the class, with a timer fallback so environments that never
 * fire animation events (jsdom, `prefers-reduced-motion`) do not wedge.
 */
function wireStopButton(button: HTMLButtonElement, taunt: HTMLElement): void {
  let clicks = 0;
  let pressTimer = 0;

  const clearPress = (): void => {
    button.classList.remove('is-pressed');
  };

  button.addEventListener('animationend', (event) => {
    if (event.target === button && event.animationName === 'stop-press') {
      clearPress();
    }
  });

  button.addEventListener('click', () => {
    clicks += 1;
    taunt.textContent = tauntFor(clicks);

    // Restart the shake from zero, even mid-animation.
    button.classList.remove('is-pressed');
    void button.offsetWidth; // force reflow so the re-add restarts the run
    button.classList.add('is-pressed');

    const view = button.ownerDocument.defaultView;
    if (view) {
      view.clearTimeout(pressTimer);
      pressTimer = view.setTimeout(clearPress, PRESS_MS * 2);
    }

    // And that is the entire handler. The wheel is not referenced here, and
    // must never be: no pause, no slowdown, no click-count easter egg.
  });
}

/**
 * Hands stage 1 (`spin-up`, a finite 2-turn accelerating run) over to stage 2
 * (`spin`, constant rate, infinite) the instant the first animation ends.
 *
 * Both keyframes start and end on whole multiples of 360deg and stage 2 runs
 * at the terminal velocity of the stage-1 easing, so the swap is invisible.
 *
 * The swap is one-way and one-shot: the listener detaches itself, so a second
 * `animationend` (or any later event) cannot toggle back or stack classes.
 * Nothing in this app ever removes `is-spinning`.
 */
function handOffToConstantSpin(wheel: HTMLElement): void {
  const onEnd = (event: Event): void => {
    // `animationend` bubbles; ignore anything from a descendant.
    if (event.target !== wheel) return;
    wheel.removeEventListener('animationend', onEnd);
    wheel.classList.remove('is-spinning-up');
    wheel.classList.add('is-spinning');
  };

  wheel.addEventListener('animationend', onEnd);
}

export function initApp(root: AppRoot): void {
  const doc = documentOf(root);
  const body = doc.body;
  const setupPanel = required<HTMLElement>(root, '#setup-panel');
  const spinPanel = required<HTMLElement>(root, '#spin-panel');

  renderSetupPanel(setupPanel);

  const form = required<HTMLFormElement>(setupPanel, '#options-form');

  // `pageshow` fires on fresh loads *and* on bfcache restores, so this wipes
  // anything form-state restoration tried to bring back across a reload. Once
  // the panel is detached there is nothing left to clear.
  doc.defaultView?.addEventListener('pageshow', () => {
    if (setupPanel.isConnected) clearFields(setupPanel);
  });

  let spinning = false;

  form.addEventListener('submit', (event) => {
    // Never navigate. Note this is the only thing we do to the event — no
    // beforeunload, no history games; browser back/reload stay untouched.
    event.preventDefault();
    if (spinning) return;
    spinning = true;

    const svg = buildWheel(readLabels(form));
    const stage = buildStage(doc, svg);
    const controls = buildControls(doc);
    spinPanel.replaceChildren(stage, controls);
    spinPanel.removeAttribute('hidden');

    const wheel = required<HTMLElement>(stage, '.wheel');
    handOffToConstantSpin(wheel);

    wireStopButton(
      required<HTMLButtonElement>(controls, '#stop-btn'),
      required<HTMLElement>(controls, '#taunt'),
    );

    // Removed, not hidden: the form must be unreachable by tab or devtools.
    // A reload is the only way back to setup.
    setupPanel.remove();

    body.classList.remove('setup');
    body.classList.add('spinning');
  });
}
