/**
 * Wheel geometry.
 *
 * `buildWheel` is a pure function: it reads no app state, touches no globals
 * beyond `document.createElementNS`, and never inserts anything into the
 * document. The caller owns placement.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Inclusive bounds on the slice count the wheel can draw. */
export const MIN_SLICES = 2;
export const MAX_SLICES = 12;

const CENTER = 200;
const RADIUS = 180;
const LABEL_RADIUS = 115;
const HUB_RADIUS = 34;

const ELLIPSIS = '…';

/**
 * How much room a label has, in user units, measured along its spoke.
 *
 * This is the constraint that actually governs, and it is worth being precise
 * about because the obvious intuition is wrong: a label runs *radially*, so
 * the space it has is set by the distance from the hub to the rim, and that
 * does not change when slices get wider. Text is centred at radius 115, so it
 * may run 61 units either way to stay 4 units clear of the 180 rim.
 *
 * A wheel with three slices therefore gets no more room per label than one
 * with twelve. Only the font size varies, for looks, and the budget is what
 * stops a bigger font from being cashed in for more characters.
 */
const LABEL_BUDGET = 122;

/**
 * Advance width of one character as a multiple of the font size.
 *
 * Counting characters instead of estimating width is what lets `WWWWWWWW`
 * off the rim while `iiiiiiii` is truncated for no reason — the two differ by
 * more than three times in width. These are rough averages for a semibold
 * humanist sans; they only have to be good enough to keep text inside a rim
 * it is already 4 units clear of.
 */
function charWidth(ch: string): number {
  if ("iljI.,:;'!|`".includes(ch)) return 0.32;
  if (ch === ' ') return 0.28;
  if ('ftr()[]{}/\\-'.includes(ch)) return 0.43;
  if ('MW@%'.includes(ch)) return 0.98;
  if ('mw'.includes(ch)) return 0.9;
  if (ch >= 'A' && ch <= 'Z') return 0.78;
  if (ch >= '0' && ch <= '9') return 0.59;
  if (ch === ELLIPSIS) return 0.82;
  return 0.62;
}

export function estimateLabelWidth(text: string, fontSize: number): number {
  let total = 0;
  for (const ch of text) total += charWidth(ch);
  return total * fontSize;
}

/**
 * Font sizes by slice count. Both sizes must be able to carry a useful label
 * within `LABEL_BUDGET`; narrower slices step down mostly so the text does not
 * crowd its neighbours near the rim.
 */
function fontsFor(count: number): { base: number; compact: number } {
  if (count <= 3) return { base: 21, compact: 16 };
  if (count <= 5) return { base: 19, compact: 15 };
  if (count <= 8) return { base: 17, compact: 14 };
  if (count <= 10) return { base: 15.5, compact: 13 };
  return { base: 14, compact: 12 };
}

/** Degrees to radians. Kept in one place so the conversion cannot drift. */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Round to at most 3 decimals, then stringify with trailing zeros stripped. */
function fmt(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function pointX(angleDeg: number): number {
  return CENTER + RADIUS * Math.cos(toRadians(angleDeg));
}

function pointY(angleDeg: number): number {
  return CENTER + RADIUS * Math.sin(toRadians(angleDeg));
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tag);
}

function setAttrs(el: Element, attrs: Record<string, string>): void {
  for (const [name, value] of Object.entries(attrs)) {
    el.setAttribute(name, value);
  }
}

/** Trims a label until it fits the radial budget, adding an ellipsis if cut. */
function fitLabel(label: string, fontSize: number): string {
  if (estimateLabelWidth(label, fontSize) <= LABEL_BUDGET) return label;

  const chars = Array.from(label);
  let end = chars.length;
  while (end > 0) {
    end -= 1;
    const candidate = chars.slice(0, end).join('').trimEnd() + ELLIPSIS;
    if (estimateLabelWidth(candidate, fontSize) <= LABEL_BUDGET) return candidate;
  }
  return ELLIPSIS;
}

function sliceStartAngle(index: number, count: number): number {
  // -90 puts the leading edge of slice 0 at 12 o'clock, under the pointer.
  return index * (360 / count) - 90;
}

function slicePathData(index: number, count: number): string {
  const sliceAngle = 360 / count;
  const a0 = sliceStartAngle(index, count);
  const a1 = a0 + sliceAngle;
  // The arc flag flips once a slice spans more than a semicircle, which it
  // does at the two-slice minimum; without it a 180deg+ slice draws inverted.
  const largeArc = sliceAngle > 180 ? 1 : 0;
  return (
    `M ${CENTER} ${CENTER} ` +
    `L ${fmt(pointX(a0))} ${fmt(pointY(a0))} ` +
    `A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${fmt(pointX(a1))} ${fmt(pointY(a1))} Z`
  );
}

/**
 * Slice colours cycle through the palette. With 12 tokens and a 12 slice
 * ceiling the modulo never actually wraps, but it keeps the lookup total.
 */
export function sliceToken(index: number): number {
  return (index % MAX_SLICES) + 1;
}

export function buildWheel(labels: string[]): SVGSVGElement {
  if (
    !Array.isArray(labels) ||
    labels.length < MIN_SLICES ||
    labels.length > MAX_SLICES
  ) {
    throw new Error(
      `buildWheel expects between ${MIN_SLICES} and ${MAX_SLICES} labels, received ${
        Array.isArray(labels) ? labels.length : typeof labels
      }.`,
    );
  }

  const count = labels.length;
  const sliceAngle = 360 / count;
  const fonts = fontsFor(count);

  // One size for the whole wheel — mismatched font sizes look broken. Step
  // down only if some label cannot be carried at the base size, and truncate
  // only what still will not fit at the smaller one.
  const fitsAtBase = labels.every(
    (label) => estimateLabelWidth(label, fonts.base) <= LABEL_BUDGET,
  );
  const fontSize = fitsAtBase ? fonts.base : fonts.compact;
  const displayLabels = labels.map((label) => fitLabel(label, fontSize));

  const svg = svgEl('svg');
  setAttrs(svg, {
    xmlns: SVG_NS,
    viewBox: '0 0 400 400',
    // Deliberately not `wheel`: the caller wraps this svg in a rotating
    // `div.wheel`, and a shared class name would rotate the svg a second
    // time inside its own animated parent.
    class: 'wheel__svg',
    role: 'img',
  });

  // 1. Slices.
  for (let i = 0; i < count; i += 1) {
    const path = svgEl('path');
    setAttrs(path, {
      d: slicePathData(i, count),
      fill: `var(--slice-${sliceToken(i)})`,
      class: 'wheel__slice',
    });
    svg.appendChild(path);
  }

  // 2. Labels, authored on the +x axis and rotated onto their bisector so the
  //    text reads outward along the spoke.
  for (let i = 0; i < count; i += 1) {
    const bisector = sliceStartAngle(i, count) + sliceAngle / 2;
    const text = svgEl('text');
    setAttrs(text, {
      x: fmt(CENTER + LABEL_RADIUS),
      y: fmt(CENTER),
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'font-size': `${fmt(fontSize)}px`,
      // Each slice carries its own ink colour so dark text sits on the pale
      // fill of its own slice, rather than one colour fighting all of them.
      fill: `var(--slice-ink-${sliceToken(i)})`,
      class: 'wheel__label',
      transform: `rotate(${fmt(bisector)} ${CENTER} ${CENTER})`,
    });
    text.textContent = displayLabels[i];
    svg.appendChild(text);
  }

  // 3. Hub, then 4. rim — both drawn last so they cover the slice edges.
  const hub = svgEl('circle');
  setAttrs(hub, {
    cx: fmt(CENTER),
    cy: fmt(CENTER),
    r: fmt(HUB_RADIUS),
    fill: 'var(--surface)',
    stroke: 'var(--rule-strong)',
    'stroke-width': '1.5',
    class: 'wheel__hub',
  });
  svg.appendChild(hub);

  const rim = svgEl('circle');
  setAttrs(rim, {
    cx: fmt(CENTER),
    cy: fmt(CENTER),
    r: fmt(RADIUS),
    fill: 'none',
    stroke: 'var(--rule-strong)',
    'stroke-width': '2',
    class: 'wheel__rim',
  });
  svg.appendChild(rim);

  return svg;
}
