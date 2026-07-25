/**
 * App wiring: renders the setup form, then performs the one-way switch from
 * the setup phase to the spinning phase.
 *
 * `initApp` takes the root it should operate on so the transition is testable
 * against a synthetic container; `main.ts` simply passes the real `document`.
 */

import { renderSetupPanel, readLabels, clearFields } from './form';
import { buildWheel } from './wheel';

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
    spinPanel.replaceChildren(stage);
    spinPanel.removeAttribute('hidden');

    const wheel = required<HTMLElement>(stage, '.wheel');
    handOffToConstantSpin(wheel);

    // Removed, not hidden: the form must be unreachable by tab or devtools.
    // A reload is the only way back to setup.
    setupPanel.remove();

    body.classList.remove('setup');
    body.classList.add('spinning');
  });
}
