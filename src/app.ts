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
import { createTicker, type Ticker } from './sound';

export type AppRoot = Document | HTMLElement;

const SVG_NS = 'http://www.w3.org/2000/svg';

function documentOf(root: AppRoot): Document {
  return root instanceof Document ? root : root.ownerDocument;
}

function required<E extends Element>(root: AppRoot, selector: string): E {
  const el = root.querySelector<E>(selector);
  if (!el) throw new Error(`Missing ${selector} element`);
  return el;
}

function icon(doc: Document, ...paths: string[]): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const d of paths) {
    const path = doc.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}

const SPEAKER_BODY = 'M3 8 L6 8 L10 4 L10 16 L6 12 L3 12 Z';
const SPEAKER_WAVES = 'M13 7.5 A3.5 3.5 0 0 1 13 12.5 M15.5 5 A7 7 0 0 1 15.5 15';
const SPEAKER_CROSS = 'M13 8 L17 12 M17 8 L13 12';

/**
 * Builds the spinning-phase stage. The svg is wrapped in `div.wheel` — that
 * div is what rotates — and `.pointer` deliberately sits outside it so it
 * stays put while the wheel turns.
 *
 * `.stage__clip` exists purely so the wheel can be sized to the full width of
 * its box. A rotating square sweeps a circle of its own diagonal, so the
 * corners of an unclipped wheel push ~21% past each edge and produce
 * horizontal scroll. Those corners are empty — the art is a circle inscribed
 * in the box — so clipping them costs nothing visible and buys back the ~30%
 * of width the old diagonal allowance had to reserve. The pointer stays
 * outside the clip because it overhangs the top edge on purpose.
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

  const clip = doc.createElement('div');
  clip.className = 'stage__clip';
  clip.appendChild(wheel);

  stage.append(pointer, clip);
  return stage;
}

/** Keep in sync with the `stop-press` duration in src/style.css. */
const PRESS_MS = 260;

/**
 * Builds the controls block: the mute toggle, the fake stop button and its
 * taunt line.
 *
 * The stop button is wrapped in its own slot because two separate things want
 * to transform it — the dodge offset and the press shake — and an animation
 * beats an inline style on the same property, so a shake would snap the
 * button back to its undodged position mid-flight. The slot carries the
 * dodge, the button carries the shake.
 *
 * The taunt starts empty on purpose — a pre-filled line would give away that
 * the messages are canned. `role="status"` plus `aria-live="polite"` means a
 * screen reader announces each new line, which is what a sincere app would do
 * and is therefore what this one does.
 */
function buildControls(doc: Document): HTMLElement {
  const controls = doc.createElement('div');
  controls.className = 'controls';

  const mute = doc.createElement('button');
  mute.type = 'button';
  mute.id = 'mute-btn';
  mute.className = 'icon-btn';
  mute.setAttribute('aria-pressed', 'false');
  mute.setAttribute('aria-label', 'Mute the wheel');
  mute.appendChild(icon(doc, SPEAKER_BODY, SPEAKER_WAVES));

  const utility = doc.createElement('div');
  utility.className = 'controls__utility';
  utility.appendChild(mute);

  const slot = doc.createElement('div');
  slot.className = 'stop-slot';

  const button = doc.createElement('button');
  button.type = 'button';
  button.id = 'stop-btn';
  button.className = 'stop-btn';
  button.textContent = 'STOP THE WHEEL';
  slot.appendChild(button);

  const taunt = doc.createElement('p');
  taunt.id = 'taunt';
  taunt.className = 'taunt';
  taunt.setAttribute('role', 'status');
  taunt.setAttribute('aria-live', 'polite');

  controls.append(utility, slot, taunt);
  return controls;
}

/** How close the pointer may get, in px, before the button bolts. */
const DODGE_RADIUS = 110;
/** How far it goes when it does. Slightly over the radius, so one hop clears. */
const DODGE_JUMP = 132;
/** It never flees off-screen; this much of the viewport edge is kept clear. */
const DODGE_MARGIN = 12;

function clamp(value: number, low: number, high: number): number {
  // low > high when the viewport is narrower than the button, in which case
  // there is no legal offset at all and staying put is the only answer.
  if (low > high) return 0;
  return Math.min(high, Math.max(low, value));
}

/**
 * Makes the stop button flinch away from the cursor.
 *
 * This is a second layer of the same joke and obeys the same rule as the
 * first: it moves the button and nothing else. It never touches the wheel.
 *
 * It is deliberately *catchable*. The offset is clamped to the viewport, so a
 * button driven into a corner has nowhere left to go and can be clicked —
 * which is the point, because the taunts are the reward for cornering it. An
 * uncatchable button would just be a dead end.
 *
 * Mouse only. Coarse pointers do not hover, so on a phone the only pointer
 * events arrive mid-tap and dodging then would read as a broken button rather
 * than a joke. Keyboard users reach it with Tab and Enter, untouched.
 */
function wireDodgingButton(slot: HTMLElement, button: HTMLButtonElement): void {
  const view = slot.ownerDocument.defaultView;
  if (!view) return;

  let dx = 0;
  let dy = 0;
  let rest: DOMRect | null = null;
  let sidestep = 1;

  // Where the button sits with no offset applied. Measured lazily rather than
  // at wire time, because `body.spinning` lands after this runs and reflows
  // the whole page, and re-measured on resize, where the offsets reset anyway.
  //
  // It must be cached rather than read per event. The slot glides to each new
  // offset over 240ms, so a live `getBoundingClientRect` during that glide
  // reports a position part-way there; subtracting the *logical* dx from it
  // then yields a rest position that is short by however much of the
  // transition is left, and the clamp derived from it lets the button walk
  // clean off the screen.
  const restBox = (): DOMRect => {
    rest ??= button.getBoundingClientRect();
    return rest;
  };

  view.addEventListener('resize', () => {
    rest = null;
    dx = 0;
    dy = 0;
    slot.style.transform = '';
  });

  view.addEventListener(
    'pointermove',
    (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;

      const base = restBox();
      if (base.width === 0) return; // not laid out yet

      const left = base.left + dx;
      const top = base.top + dy;
      const right = left + base.width;
      const bottom = top + base.height;

      // Distance to the button's edge, not its centre: a wide button whose
      // near edge is under the cursor is being approached, whatever its
      // centre says.
      const nearestX = clamp(event.clientX, left, right);
      const nearestY = clamp(event.clientY, top, bottom);
      if (Math.hypot(event.clientX - nearestX, event.clientY - nearestY) > DODGE_RADIUS) {
        return;
      }

      let awayX = left + base.width / 2 - event.clientX;
      let awayY = top + base.height / 2 - event.clientY;

      // A 420px-wide button approached from directly below has an away-vector
      // that is almost purely vertical, so it would only ever bounce up and
      // down the page. Below a fifth of its half-width the horizontal
      // component is treated as no preference at all, and it breaks the tie by
      // alternating — which also stops it oscillating along one axis.
      if (Math.abs(awayX) < base.width * 0.1) {
        awayX = sidestep * base.width * 0.5;
        sidestep = -sidestep;
      }

      const length = Math.hypot(awayX, awayY) || 1;

      // Clamped to the viewport, so it can be cornered and clicked, and so a
      // downward hop never lengthens the document into a scrollbar.
      dx = clamp(
        dx + (awayX / length) * DODGE_JUMP,
        DODGE_MARGIN - base.left,
        view.innerWidth - DODGE_MARGIN - base.width - base.left,
      );
      dy = clamp(
        dy + (awayY / length) * DODGE_JUMP,
        DODGE_MARGIN - base.top,
        view.innerHeight - DODGE_MARGIN - base.height - base.top,
      );

      slot.style.transform = `translate(${Math.round(dx)}px, ${Math.round(dy)}px)`;
    },
    { passive: true },
  );
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

/** The mute toggle is the only control on this screen that does its job. */
function wireMuteButton(button: HTMLButtonElement, ticker: Ticker): void {
  const doc = button.ownerDocument;

  button.addEventListener('click', () => {
    const muted = !ticker.isMuted();
    ticker.setMuted(muted);
    button.setAttribute('aria-pressed', String(muted));
    button.setAttribute('aria-label', muted ? 'Unmute the wheel' : 'Mute the wheel');
    button.classList.toggle('is-muted', muted);
    button.replaceChildren(
      muted
        ? icon(doc, SPEAKER_BODY, SPEAKER_CROSS)
        : icon(doc, SPEAKER_BODY, SPEAKER_WAVES),
    );
  });
}

/**
 * The moment stage 1 finished, on the document timeline, or `null` where the
 * environment cannot say (jsdom has no Web Animations API).
 */
function animationEndTime(wheel: HTMLElement): number | null {
  if (typeof wheel.getAnimations !== 'function') return null;

  for (const animation of wheel.getAnimations()) {
    const start = animation.startTime;
    const active = animation.effect?.getComputedTiming().activeDuration;
    if (typeof start === 'number' && typeof active === 'number') {
      return start + active;
    }
  }

  return null;
}

/**
 * Hands stage 1 (`spin-up`, a finite 2-turn accelerating run) over to stage 2
 * (`spin`, constant rate, infinite) the instant the first animation ends.
 *
 * Both keyframes start and end on whole multiples of 360deg and stage 2 runs
 * at the terminal velocity of the stage-1 easing, so the swap is invisible.
 *
 * Backdating stage 2 is what makes it invisible in practice. Stage 1 lands on
 * 720deg on a frame boundary, but `animationend` is only delivered on the next
 * tick, and stage 2 would otherwise begin its own timeline from zero at that
 * point. Since 720deg and 0deg are the same angle, the wheel then renders the
 * identical frame twice and drops ~6.7deg of travel — a single-frame hitch at
 * the exact moment the handoff has to be seamless. Anchoring stage 2's
 * `startTime` to when stage 1 actually ended absorbs the delay instead, and
 * self-corrects if the tick is delayed by more than one frame.
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

    const endedAt = animationEndTime(wheel);

    wheel.classList.remove('is-spinning-up');
    wheel.classList.add('is-spinning');

    if (endedAt !== null) {
      for (const animation of wheel.getAnimations()) {
        animation.startTime = endedAt;
      }
    }
  };

  wheel.addEventListener('animationend', onEnd);
}

type MatrixCtor = new (init?: string) => { a: number; b: number };

/**
 * Reads the wheel's rendered rotation, or `null` where the environment cannot
 * parse a transform matrix. jsdom is the case that matters: it runs no
 * animations and has no `DOMMatrix`, so the whole spin loop stays off
 * there rather than throwing or spinning uselessly through every unit test.
 */
function matrixCtorFor(view: Window): MatrixCtor | null {
  const candidate =
    (view as unknown as { DOMMatrixReadOnly?: MatrixCtor }).DOMMatrixReadOnly ??
    (view as unknown as { DOMMatrix?: MatrixCtor }).DOMMatrix;
  return typeof candidate === 'function' ? candidate : null;
}

/**
 * One animation-frame loop reading the wheel's rotation for the ticker.
 *
 * The angle handed on is cumulative and unwrapped — always increasing — so a
 * consumer can divide it for a slice index without special-casing the wrap at
 * 360deg.
 *
 * There is no stop condition, by design. The wheel never stops, so neither
 * does the sound it makes.
 */
function startSpinLoop(wheel: HTMLElement, sliceCount: number, ticker: Ticker): void {
  const view = wheel.ownerDocument.defaultView;
  if (!view) return;

  const Matrix = matrixCtorFor(view);
  if (!Matrix) return;

  let cumulative = 0;
  let previous: number | null = null;

  const frame = (): void => {
    const transform = view.getComputedStyle(wheel).transform;

    if (transform && transform !== 'none') {
      const m = new Matrix(transform);
      const angle = (Math.atan2(m.b, m.a) * 180) / Math.PI;

      if (previous !== null) {
        // Rotation is always forward, so unwrap each gap into [0, 360).
        let delta = (angle - previous) % 360;
        if (delta < 0) delta += 360;
        cumulative += delta;
      }
      previous = angle;

      ticker.update(cumulative, sliceCount);
    }

    view.requestAnimationFrame(frame);
  };

  view.requestAnimationFrame(frame);
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

    const labels = readLabels(form);
    const svg = buildWheel(labels);
    const stage = buildStage(doc, svg);
    const controls = buildControls(doc);
    spinPanel.replaceChildren(stage, controls);
    spinPanel.removeAttribute('hidden');

    const wheel = required<HTMLElement>(stage, '.wheel');
    handOffToConstantSpin(wheel);

    const stopButton = required<HTMLButtonElement>(controls, '#stop-btn');
    wireStopButton(stopButton, required<HTMLElement>(controls, '#taunt'));
    wireDodgingButton(required<HTMLElement>(controls, '.stop-slot'), stopButton);

    // Created inside the click handler: an AudioContext built any earlier is
    // blocked by autoplay policy, and this submit is the user gesture.
    const view = doc.defaultView;
    const ticker = createTicker(view ?? (globalThis as unknown as Window));
    const muteButton = required<HTMLButtonElement>(controls, '#mute-btn');
    wireMuteButton(muteButton, ticker);
    muteButton.hidden = !ticker.isAvailable();

    startSpinLoop(wheel, labels.length, ticker);

    // Removed, not hidden: the form must be unreachable by tab or devtools.
    // A reload is the only way back to setup.
    setupPanel.remove();

    body.classList.remove('setup');
    body.classList.add('spinning');
  });
}
