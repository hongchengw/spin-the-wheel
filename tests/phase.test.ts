import { describe, it, expect, beforeEach } from 'vitest';
import { initApp } from '../src/app';

const APP_HTML = `
  <main class="app">
    <header class="masthead">
      <h1 class="title">Infinite Spin Trap</h1>
      <p class="subtitle">Enter your options. Let the wheel decide.</p>
    </header>
    <section id="setup-panel"></section>
    <section id="spin-panel" hidden></section>
  </main>
`;

// One word per row the form opens with. `fill` writes into the rows that are
// already there, so this list has to match the default count exactly.
const TYPED = ['Pizza', 'Sushi'];

let root: HTMLElement;

function fill(values: string[]): void {
  values.forEach((value, i) => {
    const input = root.querySelector<HTMLInputElement>(`#opt-${i + 1}`);
    if (!input) throw new Error(`missing #opt-${i + 1}`);
    input.value = value;
  });
}

function submit(): Event {
  const form = root.querySelector('form');
  if (!form) throw new Error('missing form');
  const event = new Event('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(event);
  return event;
}

function wheelTexts(): string[] {
  return Array.from(root.querySelectorAll('#wheel svg text')).map(
    (node) => node.textContent ?? '',
  );
}

beforeEach(() => {
  document.body.innerHTML = APP_HTML;
  document.body.className = 'setup';
  root = document.body;
  initApp(root);
});

describe('before submit', () => {
  it('shows the setup panel with 2 inputs, keeps the spin panel hidden, and body is in the setup phase', () => {
    const setupPanel = root.querySelector('#setup-panel');
    expect(setupPanel).not.toBeNull();
    expect(setupPanel!.querySelectorAll('input')).toHaveLength(2);

    const spinPanel = root.querySelector('#spin-panel');
    expect(spinPanel).not.toBeNull();
    expect(spinPanel!.hasAttribute('hidden')).toBe(true);

    expect(document.body.classList.contains('setup')).toBe(true);
    expect(document.body.classList.contains('spinning')).toBe(false);
  });
});

describe('after submit', () => {
  it('swaps the body class from setup to spinning', () => {
    submit();
    expect(document.body.classList.contains('spinning')).toBe(true);
    expect(document.body.classList.contains('setup')).toBe(false);
  });

  it('reveals the spin panel by removing its hidden attribute', () => {
    submit();
    const spinPanel = root.querySelector('#spin-panel');
    expect(spinPanel).not.toBeNull();
    expect(spinPanel!.hasAttribute('hidden')).toBe(false);
  });

  it('removes #setup-panel from the DOM entirely', () => {
    submit();
    expect(root.querySelector('#setup-panel')).toBeNull();
  });

  it('leaves zero input elements anywhere in the DOM', () => {
    submit();
    expect(root.querySelectorAll('input')).toHaveLength(0);
  });

  it('mounts an svg inside #wheel, which carries the wheel class', () => {
    submit();
    const wheel = root.querySelector('#wheel');
    expect(wheel).not.toBeNull();
    expect(wheel!.classList.contains('wheel')).toBe(true);
    expect(wheel!.querySelector('svg')).not.toBeNull();
  });

  it('makes the svg a child of .wheel rather than a sibling', () => {
    submit();
    const wheel = root.querySelector<HTMLElement>('.wheel');
    expect(wheel).not.toBeNull();
    const svg = wheel!.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.parentElement).not.toBeNull();
    expect(svg!.parentElement!.classList.contains('wheel')).toBe(true);
  });

  it('keeps the pointer outside the wheel', () => {
    submit();
    const pointer = root.querySelector('.pointer');
    expect(pointer).not.toBeNull();
    const wheel = root.querySelector('.wheel');
    expect(wheel).not.toBeNull();
    expect(wheel!.contains(pointer)).toBe(false);
  });

  it('carries the typed values onto the wheel in order', () => {
    fill(TYPED);
    submit();
    expect(wheelTexts()).toEqual(TYPED);
  });

  it('carries blank fields onto the wheel as Option N fallbacks', () => {
    const values = [...TYPED];
    values[1] = '';
    fill(values);
    submit();
    expect(wheelTexts()[1]).toBe('Option 2');
  });

  it('prevents the default submit so the page never navigates', () => {
    const event = submit();
    expect(event.defaultPrevented).toBe(true);
  });
});

/**
 * A spin that cannot be built must not take the app down with it.
 *
 * `buildWheel` throws outside its 2-12 slice range, and the submit handler sets
 * a one-way `spinning` latch. If that latch were set before the build, the
 * throw would leave the app latched but unspun: no wheel, the form still
 * present, and every later submit short-circuiting for the rest of the page's
 * life. These tests pin the ordering that prevents it.
 */
describe('when the wheel cannot be built', () => {
  /**
   * Deletes a row straight from the DOM to force an out-of-range count. The
   * add/remove controls clamp to 2-12, so tampering is the only way in — which
   * is exactly the case the ordering has to survive.
   */
  function dropRow(): void {
    const rows = root.querySelectorAll('#option-list .field');
    rows[rows.length - 1].remove();
  }

  /**
   * Submits and absorbs the handler's exception however the environment
   * surfaces it: jsdom reports a throwing listener as an `error` event on the
   * window rather than letting it escape `dispatchEvent`.
   */
  function submitExpectingFailure(): void {
    const swallow = (event: Event): void => event.preventDefault();
    window.addEventListener('error', swallow);
    try {
      submit();
    } catch {
      // Environments that do let it escape are equally fine.
    } finally {
      window.removeEventListener('error', swallow);
    }
  }

  it('leaves the setup panel in place', () => {
    dropRow();
    submitExpectingFailure();
    expect(root.querySelector('#setup-panel')).not.toBeNull();
  });

  it('does not switch the body into the spinning phase', () => {
    dropRow();
    submitExpectingFailure();
    expect(document.body.classList.contains('setup')).toBe(true);
    expect(document.body.classList.contains('spinning')).toBe(false);
  });

  it('mounts no wheel and leaves the spin panel hidden', () => {
    dropRow();
    submitExpectingFailure();
    expect(root.querySelector('#wheel')).toBeNull();
    expect(root.querySelector('#spin-panel')!.hasAttribute('hidden')).toBe(true);
  });

  it('still spins once the row count is valid again', () => {
    dropRow();
    submitExpectingFailure();

    // Back to a legal count through the app's own control, then retry. A
    // latched app would silently do nothing here.
    root.querySelector<HTMLButtonElement>('#add-option')!.click();
    fill(TYPED);
    submit();

    expect(wheelTexts()).toEqual(TYPED);
    expect(document.body.classList.contains('spinning')).toBe(true);
  });
});
