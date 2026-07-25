/**
 * Wheel geometry.
 *
 * `buildWheel` is a pure function: it reads no app state, touches no globals
 * beyond `document.createElementNS`, and never inserts anything into the
 * document. The caller owns placement.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

const SLICE_COUNT = 8;
const CENTER = 200;
const RADIUS = 180;
const SLICE_ANGLE = 360 / SLICE_COUNT; // 45
const LABEL_RADIUS = 115;
const HUB_RADIUS = 34;

const MAX_LABEL_CHARS = 14;
const ELLIPSIS = '…';
const COMPACT_LABEL_THRESHOLD = 10;
const FONT_SIZE_DEFAULT = '17px';
const FONT_SIZE_COMPACT = '14px';

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

/** Long labels spill past the rim, so clamp them to 13 chars plus an ellipsis. */
function truncateLabel(label: string): string {
  if (label.length <= MAX_LABEL_CHARS) return label;
  return label.slice(0, MAX_LABEL_CHARS - 1) + ELLIPSIS;
}

function sliceStartAngle(index: number): number {
  // -90 puts the leading edge of slice 0 at 12 o'clock, under the pointer.
  return index * SLICE_ANGLE - 90;
}

function slicePathData(index: number): string {
  const a0 = sliceStartAngle(index);
  const a1 = a0 + SLICE_ANGLE;
  return (
    `M ${CENTER} ${CENTER} ` +
    `L ${fmt(pointX(a0))} ${fmt(pointY(a0))} ` +
    `A ${RADIUS} ${RADIUS} 0 0 1 ${fmt(pointX(a1))} ${fmt(pointY(a1))} Z`
  );
}

export function buildWheel(labels: string[]): SVGSVGElement {
  if (!Array.isArray(labels) || labels.length !== SLICE_COUNT) {
    throw new Error(
      `buildWheel expects exactly ${SLICE_COUNT} labels, received ${
        Array.isArray(labels) ? labels.length : typeof labels
      }.`,
    );
  }

  const displayLabels = labels.map(truncateLabel);
  const fontSize = displayLabels.some(
    (label) => label.length > COMPACT_LABEL_THRESHOLD,
  )
    ? FONT_SIZE_COMPACT
    : FONT_SIZE_DEFAULT;

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
  for (let i = 0; i < SLICE_COUNT; i += 1) {
    const path = svgEl('path');
    setAttrs(path, {
      d: slicePathData(i),
      fill: `var(--slice-${i + 1})`,
      class: 'wheel__slice',
    });
    svg.appendChild(path);
  }

  // 2. Labels, authored on the +x axis and rotated onto their bisector so the
  //    text reads outward along the spoke.
  for (let i = 0; i < SLICE_COUNT; i += 1) {
    const bisector = sliceStartAngle(i) + SLICE_ANGLE / 2;
    const text = svgEl('text');
    setAttrs(text, {
      x: fmt(CENTER + LABEL_RADIUS),
      y: fmt(CENTER),
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'font-size': fontSize,
      fill: 'var(--text)',
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
    stroke: 'var(--accent)',
    'stroke-width': '3',
    class: 'wheel__hub',
  });
  svg.appendChild(hub);

  const rim = svgEl('circle');
  setAttrs(rim, {
    cx: fmt(CENTER),
    cy: fmt(CENTER),
    r: fmt(RADIUS),
    fill: 'none',
    stroke: 'var(--accent)',
    'stroke-width': '6',
    class: 'wheel__rim',
  });
  svg.appendChild(rim);

  return svg;
}
