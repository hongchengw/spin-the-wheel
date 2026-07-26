/**
 * The pointer tick.
 *
 * A prize wheel that turns in silence reads as a video of a prize wheel, so
 * each slice passing the pointer gets a click. It is synthesised rather than
 * loaded: a sample would be a network request and a runtime asset, and this
 * project has neither.
 *
 * The tick is driven off the wheel's measured angle rather than a timer, so it
 * stays locked to what the user can see even while stage 1 is accelerating. It
 * is frame-quantised, which at up to ~13 ticks per second is inaudible as
 * jitter and always in sync — the tradeoff a scheduled-ahead timer would get
 * backwards.
 */

/** Peak gain of one click. Deliberately quiet; this plays forever. */
const TICK_GAIN = 0.05;
/** Click envelope. Short enough that ticks never overlap at 12 slices. */
const TICK_MS = 26;
/** Highest number of clicks per second worth rendering. */
const MAX_TICKS_PER_SEC = 24;

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(view: Window): AudioContextCtor | null {
  // `Window` alone does not carry the global constructors; only
  // `Window & typeof globalThis` does, and jsdom supplies neither.
  const scope = view as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  const candidate = scope.AudioContext ?? scope.webkitAudioContext;
  return typeof candidate === 'function' ? candidate : null;
}

export interface Ticker {
  /** Feed the cumulative unwrapped angle; fires a click per slice boundary. */
  update(angleDeg: number, sliceCount: number): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  isAvailable(): boolean;
}

/**
 * Must be called from a user gesture — the Spin click — or the browser will
 * refuse to start the audio context. Silently degrades to a no-op ticker where
 * Web Audio is missing, because a missing click is not worth breaking on.
 */
export function createTicker(view: Window): Ticker {
  const Ctor = audioContextCtor(view);
  let ctx: AudioContext | null = null;

  if (Ctor) {
    try {
      ctx = new Ctor();
    } catch {
      ctx = null;
    }
  }

  let muted = false;
  let lastSlice: number | null = null;
  let lastTickAt = -Infinity;

  function click(): void {
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    // A bandpass turns the square's buzz into a short wooden knock, which is
    // what a pawl hitting a peg actually sounds like.
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1850;
    filter.Q.value = 1.6;

    osc.type = 'square';
    osc.frequency.setValueAtTime(2100, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + TICK_MS / 1000);

    gain.gain.setValueAtTime(TICK_GAIN, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + TICK_MS / 1000);

    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + TICK_MS / 1000);
  }

  return {
    update(angleDeg: number, sliceCount: number): void {
      if (sliceCount <= 0) return;

      const slice = Math.floor(angleDeg / (360 / sliceCount));
      const previous = lastSlice;
      lastSlice = slice;

      if (previous === null || slice === previous) return;
      if (muted || !ctx) return;

      // Guards the very fast spin-up frames and any timeline jump.
      const now = ctx.currentTime;
      if (now - lastTickAt < 1 / MAX_TICKS_PER_SEC) return;
      lastTickAt = now;

      if (ctx.state === 'suspended') void ctx.resume();
      click();
    },

    setMuted(next: boolean): void {
      muted = next;
    },

    isMuted(): boolean {
      return muted;
    },

    isAvailable(): boolean {
      return ctx !== null;
    },
  };
}
