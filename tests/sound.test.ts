/**
 * The ticker, exercised against a stub AudioContext.
 *
 * jsdom has no Web Audio, which is itself worth asserting: the app must stay
 * completely functional without sound rather than throwing on a missing API.
 */

import { describe, it, expect, vi } from 'vitest';
import { createTicker } from '../src/sound';

/** Minimal stand-in for the handful of Web Audio calls the ticker makes. */
function stubView(): { view: Window; starts: () => number } {
  let starts = 0;
  let currentTime = 0;

  const node = () => ({
    connect: (next: unknown) => next,
    frequency: { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    type: '',
    Q: { value: 0 },
    start: () => {
      starts += 1;
      // Advance the clock so the ticker's rate limiter does not swallow the
      // next click; a real context's currentTime moves on its own.
      currentTime += 0.5;
    },
    stop: () => {},
  });

  const ctx = {
    get currentTime() {
      return currentTime;
    },
    state: 'running',
    resume: () => Promise.resolve(),
    createOscillator: node,
    createGain: node,
    createBiquadFilter: node,
    destination: {},
  };

  const view = { AudioContext: function () { return ctx; } } as unknown as Window;
  return { view, starts: () => starts };
}

describe('createTicker without Web Audio', () => {
  it('reports itself unavailable rather than throwing', () => {
    const ticker = createTicker({} as Window);
    expect(ticker.isAvailable()).toBe(false);
  });

  it('accepts angle updates silently', () => {
    const ticker = createTicker({} as Window);
    expect(() => {
      ticker.update(0, 8);
      ticker.update(180, 8);
      ticker.update(720, 8);
    }).not.toThrow();
  });
});

describe('createTicker with Web Audio', () => {
  it('reports itself available', () => {
    const { view } = stubView();
    expect(createTicker(view).isAvailable()).toBe(true);
  });

  it('does not click until a slice boundary is crossed', () => {
    const { view, starts } = stubView();
    const ticker = createTicker(view);

    ticker.update(0, 8); // first sample only establishes the baseline
    expect(starts()).toBe(0);

    ticker.update(10, 8); // still inside slice 0 of 45deg
    expect(starts()).toBe(0);

    ticker.update(50, 8); // crossed into slice 1
    expect(starts()).toBe(1);
  });

  it('clicks once per slice as the wheel turns', () => {
    const { view, starts } = stubView();
    const ticker = createTicker(view);

    ticker.update(0, 4); // 90deg slices
    for (let angle = 90; angle <= 360; angle += 90) {
      ticker.update(angle, 4);
    }

    expect(starts()).toBe(4);
  });

  it('goes silent when muted and resumes when unmuted', () => {
    const { view, starts } = stubView();
    const ticker = createTicker(view);

    ticker.update(0, 4);
    ticker.setMuted(true);
    expect(ticker.isMuted()).toBe(true);

    ticker.update(90, 4);
    ticker.update(180, 4);
    expect(starts()).toBe(0);

    ticker.setMuted(false);
    ticker.update(270, 4);
    expect(starts()).toBe(1);
  });

  it('ignores a nonsensical slice count instead of dividing by zero', () => {
    const { view, starts } = stubView();
    const ticker = createTicker(view);
    expect(() => ticker.update(90, 0)).not.toThrow();
    expect(starts()).toBe(0);
  });

  it('survives a context whose constructor throws', () => {
    const view = {
      AudioContext: function () {
        throw new Error('blocked by autoplay policy');
      },
    } as unknown as Window;

    const ticker = createTicker(view);
    expect(ticker.isAvailable()).toBe(false);
    expect(() => ticker.update(90, 8)).not.toThrow();
  });
});

describe('the ticker never touches the wheel', () => {
  it('exposes no method that could affect rotation', () => {
    const ticker = createTicker(stubView().view);
    expect(Object.keys(ticker).sort()).toEqual([
      'isAvailable',
      'isMuted',
      'setMuted',
      'update',
    ]);
    expect(vi.isMockFunction(ticker.update)).toBe(false);
  });
});
