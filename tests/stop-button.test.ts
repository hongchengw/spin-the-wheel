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

let root: HTMLElement;

function submit(): void {
  const form = root.querySelector('form');
  if (!form) throw new Error('missing form');
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function stopButton(): HTMLButtonElement {
  const btn = root.querySelector<HTMLButtonElement>('#stop-btn');
  if (!btn) throw new Error('missing #stop-btn');
  return btn;
}

function taunt(): HTMLElement {
  const el = root.querySelector<HTMLElement>('#taunt');
  if (!el) throw new Error('missing #taunt');
  return el;
}

function wheel(): HTMLElement {
  const el = root.querySelector<HTMLElement>('#wheel');
  if (!el) throw new Error('missing #wheel');
  return el;
}

function click(times = 1): void {
  const btn = stopButton();
  for (let i = 0; i < times; i += 1) {
    btn.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
  }
}

beforeEach(() => {
  document.body.innerHTML = APP_HTML;
  document.body.className = 'setup';
  root = document.body;
  initApp(root);
  submit();
});

describe('the fake stop button', () => {
  it('exists after the phase switch with the right id and label', () => {
    const btn = stopButton();
    expect(btn.id).toBe('stop-btn');
    expect(btn.textContent).toBe('STOP THE WHEEL');
    expect(btn.type).toBe('button');
  });

  it('starts with an empty taunt line', () => {
    expect(taunt().textContent).toBe('');
  });

  it('sets the first taunt on the first click', () => {
    click();
    expect(taunt().textContent).toBe('Slowing down…');
  });

  it('lands on No. by the sixth click and stays there on the seventh', () => {
    click(6);
    expect(taunt().textContent).toBe('No.');
    click();
    expect(taunt().textContent).toBe('No.');
  });

  it('is never disabled and is never removed', () => {
    click(10);
    const btn = stopButton();
    expect(btn.disabled).toBe(false);
    expect(btn.hasAttribute('disabled')).toBe(false);
    expect(btn.isConnected).toBe(true);
  });

  it('never changes its own label', () => {
    click(10);
    expect(stopButton().textContent).toBe('STOP THE WHEEL');
  });

  it('does not touch the wheel classes', () => {
    const before = wheel().className;
    click(10);
    expect(wheel().className).toBe(before);
  });

  it('does not remove or replace the svg', () => {
    const svgBefore = wheel().querySelector('svg');
    expect(svgBefore).not.toBeNull();
    click(10);
    const svgAfter = wheel().querySelector('svg');
    expect(svgAfter).toBe(svgBefore);
    expect(svgAfter!.parentElement).toBe(wheel());
  });

  it('sits in a .controls block after the stage inside #spin-panel', () => {
    const panel = root.querySelector('#spin-panel');
    expect(panel).not.toBeNull();
    const controls = panel!.querySelector('.controls');
    expect(controls).not.toBeNull();
    expect(controls!.previousElementSibling?.classList.contains('stage')).toBe(
      true,
    );
    expect(controls!.contains(stopButton())).toBe(true);
    expect(controls!.contains(taunt())).toBe(true);
  });

  it('announces the taunt politely to screen readers', () => {
    const el = taunt();
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
  });

  it('replays the press animation class on every click', () => {
    const btn = stopButton();
    click();
    expect(btn.classList.contains('is-pressed')).toBe(true);
    click();
    expect(btn.classList.contains('is-pressed')).toBe(true);
  });
});
