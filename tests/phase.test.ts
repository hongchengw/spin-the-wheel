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

const TYPED = [
  'Pizza',
  'Sushi',
  'Tacos',
  'Ramen',
  'Curry',
  'Salad',
  'Burger',
  'Pasta',
];

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
  it('shows the setup panel with 8 inputs, keeps the spin panel hidden, and body is in the setup phase', () => {
    const setupPanel = root.querySelector('#setup-panel');
    expect(setupPanel).not.toBeNull();
    expect(setupPanel!.querySelectorAll('input')).toHaveLength(8);

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
    values[3] = '';
    fill(values);
    submit();
    expect(wheelTexts()[3]).toBe('Option 4');
  });

  it('prevents the default submit so the page never navigates', () => {
    const event = submit();
    expect(event.defaultPrevented).toBe(true);
  });
});
