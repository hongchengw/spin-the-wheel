/**
 * Unit coverage for the spin-up -> spin class handoff.
 *
 * jsdom does not run CSS animations, so nothing here asserts on motion or on
 * computed animation state — that would pass happily while the app is visibly
 * broken. These tests cover the class-swapping logic only; the animation
 * itself is verified in `e2e/spin.spec.ts` against a real browser.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { initApp } from '../src/app';

const APP_HTML = `
  <main class="app">
    <header class="masthead">
      <h1 class="title">Infinite Spin Trap</h1>
      <p class="subtitle">Enter your options. Let the wheel decide.</p>
    </header>
    <section id="setup-panel" class="panel"></section>
    <section id="spin-panel" class="panel" hidden></section>
  </main>
`;

const SPIN_UP_CLASS = 'is-spinning-up';
const SPINNING_CLASS = 'is-spinning';

let root: HTMLElement;

function submit(): void {
  const form = root.querySelector('form');
  if (!form) throw new Error('missing form');
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function wheel(): HTMLElement {
  const el = root.querySelector<HTMLElement>('.wheel');
  if (!el) throw new Error('missing .wheel');
  return el;
}

function endAnimation(): void {
  wheel().dispatchEvent(
    new Event('animationend', { bubbles: true, cancelable: false }),
  );
}

beforeEach(() => {
  document.body.innerHTML = APP_HTML;
  document.body.className = 'setup';
  root = document.body;
  initApp(root);
});

describe('spin-up stage', () => {
  it('gives .wheel the spin-up class as soon as the wheel is mounted', () => {
    submit();
    expect(wheel().classList.contains(SPIN_UP_CLASS)).toBe(true);
    expect(wheel().classList.contains(SPINNING_CLASS)).toBe(false);
  });
});

describe('handoff to the constant-rate stage', () => {
  it('swaps spin-up for spinning when animationend fires on .wheel', () => {
    submit();
    endAnimation();
    expect(wheel().classList.contains(SPINNING_CLASS)).toBe(true);
    expect(wheel().classList.contains(SPIN_UP_CLASS)).toBe(false);
  });

  it('is idempotent — a second animationend leaves it spinning', () => {
    submit();
    endAnimation();
    endAnimation();
    endAnimation();

    const classes = Array.from(wheel().classList);
    expect(classes.filter((c) => c === SPINNING_CLASS)).toHaveLength(1);
    expect(classes).toContain(SPINNING_CLASS);
    expect(classes).not.toContain(SPIN_UP_CLASS);
  });

  it('never drops the spinning class on later, unrelated events', () => {
    submit();
    endAnimation();

    document.body.dispatchEvent(new Event('click', { bubbles: true }));
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    document.body.dispatchEvent(new Event('keydown', { bubbles: true }));
    wheel().dispatchEvent(new Event('click', { bubbles: true }));

    expect(wheel().classList.contains(SPINNING_CLASS)).toBe(true);
    expect(wheel().classList.contains(SPIN_UP_CLASS)).toBe(false);
  });
});
