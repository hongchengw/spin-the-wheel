import { describe, it, expect } from 'vitest';
import {
  buildWheel,
  estimateLabelWidth,
  MIN_SLICES,
  MAX_SLICES,
  MIN_CHAR_WIDTH,
} from '../src/wheel';

/** `n` short, distinct labels. */
function labelsOfLength(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `Opt${i + 1}`);
}

const SHORT_LABELS = [
  'Alpha',
  'Bravo',
  'Charlie',
  'Delta',
  'Echo',
  'Foxtrot',
  'Golf',
  'Hotel',
];

function labelsWith(index: number, value: string): string[] {
  const next = [...SHORT_LABELS];
  next[index] = value;
  return next;
}

function texts(svg: SVGSVGElement): SVGTextElement[] {
  return Array.from(svg.querySelectorAll('text')) as SVGTextElement[];
}

describe('buildWheel', () => {
  it('returns an svg element with the expected viewBox', () => {
    const svg = buildWheel(SHORT_LABELS);
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 400 400');
  });

  it('renders 8 slice paths', () => {
    const svg = buildWheel(SHORT_LABELS);
    expect(svg.querySelectorAll('path')).toHaveLength(8);
  });

  it('gives slice 0 the exact expected path data', () => {
    const svg = buildWheel(SHORT_LABELS);
    const paths = Array.from(svg.querySelectorAll('path'));
    expect(paths[0].getAttribute('d')).toBe(
      'M 200 200 L 200 20 A 180 180 0 0 1 327.279 72.721 Z',
    );
  });

  it('starts slice 2 at the 3-o-clock point', () => {
    const svg = buildWheel(SHORT_LABELS);
    const paths = Array.from(svg.querySelectorAll('path'));
    expect(paths[2].getAttribute('d')).toContain('L 380 200');
  });

  it('uses the palette custom property for each slice', () => {
    const svg = buildWheel(SHORT_LABELS);
    const paths = Array.from(svg.querySelectorAll('path'));
    paths.forEach((path, i) => {
      expect(path.getAttribute('fill')).toBe(`var(--slice-${i + 1})`);
    });
    expect(paths[0].getAttribute('fill')).toBe('var(--slice-1)');
    expect(paths[7].getAttribute('fill')).toBe('var(--slice-8)');
  });

  it('renders 8 text elements carrying the labels in order', () => {
    const svg = buildWheel(SHORT_LABELS);
    const nodes = texts(svg);
    expect(nodes).toHaveLength(8);
    expect(nodes.map((n) => n.textContent)).toEqual(SHORT_LABELS);
  });

  it('rotates each label onto its slice bisector', () => {
    const svg = buildWheel(SHORT_LABELS);
    expect(texts(svg).map((n) => n.getAttribute('transform'))).toEqual([
      'rotate(-67.5 200 200)',
      'rotate(-22.5 200 200)',
      'rotate(22.5 200 200)',
      'rotate(67.5 200 200)',
      'rotate(112.5 200 200)',
      'rotate(157.5 200 200)',
      'rotate(202.5 200 200)',
      'rotate(247.5 200 200)',
    ]);
  });

  it('authors every label on the +x axis', () => {
    const svg = buildWheel(SHORT_LABELS);
    for (const node of texts(svg)) {
      expect(node.getAttribute('x')).toBe('315');
      expect(node.getAttribute('y')).toBe('200');
      expect(node.getAttribute('text-anchor')).toBe('middle');
      expect(node.getAttribute('dominant-baseline')).toBe('middle');
    }
  });

  it('leaves a short label completely alone', () => {
    const svg = buildWheel(labelsWith(0, 'Fish tacos'));
    expect(texts(svg)[0].textContent).toBe('Fish tacos');
  });

  it('ends an over-long label with an ellipsis rather than letting it spill', () => {
    const svg = buildWheel(labelsWith(0, 'Absolutely enormous option'));
    const rendered = texts(svg)[0].textContent ?? '';
    expect(rendered.endsWith('…')).toBe(true);
    expect(rendered.length).toBeLessThan('Absolutely enormous option'.length);
  });

  it('uses 17px on an eight slice wheel of short labels', () => {
    const svg = buildWheel(SHORT_LABELS);
    for (const node of texts(svg)) {
      expect(node.getAttribute('font-size')).toBe('17px');
    }
  });

  it('steps every label down together once one will not fit', () => {
    const svg = buildWheel(labelsWith(3, 'Extraordinarily long'));
    const sizes = new Set(texts(svg).map((n) => n.getAttribute('font-size')));
    expect(sizes.size).toBe(1);
    expect([...sizes][0]).toBe('14px');
  });

  it('budgets by width, so wide letters truncate sooner than narrow ones', () => {
    const wide = texts(buildWheel(labelsWith(0, 'WWWWWWWWWWWWWWWW')))[0].textContent ?? '';
    const narrow = texts(buildWheel(labelsWith(0, 'iiiiiiiiiiiiiiii')))[0].textContent ?? '';

    // Same character count in, very different widths — so different cuts out.
    expect(wide.length).toBeLessThan(narrow.length);
    // The narrow one has no reason to be cut at all.
    expect(narrow).toBe('iiiiiiiiiiiiiiii');
  });

  it('keeps every rendered label inside the radial budget, at every count', () => {
    const nasty = [
      'WWWWWWWWWWWWWWWWWWWWWWWW', // 24 wide caps, the maxlength worst case
      'Margherita pizza',
      'MMMM WWWW MMMM',
      'A',
      'Bibimbap',
      '00000000000000000000',
      'Extraordinarily long name',
      'iiiiiiiiiiiiiiiiiiiiiiii',
      'Fish tacos with salsa',
      'Ramen',
      '@@@@@@@@@@@@',
      'Curry',
    ];

    for (let n = MIN_SLICES; n <= MAX_SLICES; n += 1) {
      const svg = buildWheel(nasty.slice(0, n));
      const size = Number((texts(svg)[0].getAttribute('font-size') ?? '').replace('px', ''));
      for (const node of texts(svg)) {
        const width = estimateLabelWidth(node.textContent ?? '', size);
        // 122 units centred at radius 115 keeps the ends clear of the 180 rim.
        expect(width).toBeLessThanOrEqual(122);
      }
    }
  });

  it('draws the hub and rim after the slices', () => {
    const svg = buildWheel(SHORT_LABELS);
    const circles = Array.from(svg.querySelectorAll('circle'));
    const hub = circles.find((c) => c.getAttribute('r') === '34');
    const rim = circles.find((c) => c.getAttribute('r') === '180');
    expect(hub).toBeDefined();
    expect(rim).toBeDefined();

    const children = Array.from(svg.children);
    expect(children[children.length - 2]).toBe(hub);
    expect(children[children.length - 1]).toBe(rim);

    const pathIndexes = children
      .map((c, i) => (c.tagName.toLowerCase() === 'path' ? i : -1))
      .filter((i) => i >= 0);
    const lastPathIndex = pathIndexes[pathIndexes.length - 1];
    expect(children.indexOf(hub!)).toBeGreaterThan(lastPathIndex);
    expect(children.indexOf(rim!)).toBeGreaterThan(children.indexOf(hub!));
  });

  it('throws outside the 2 to 12 label range', () => {
    expect(() => buildWheel([])).toThrow(Error);
    expect(() => buildWheel(['Only'])).toThrow(Error);
    expect(() => buildWheel(labelsOfLength(13))).toThrow(Error);
  });
});

/**
 * Label fitting drops one character per attempt and re-measures the whole
 * candidate, so its cost is quadratic in where the walk starts. Starting it at
 * the raw label length meant an oversized label — reachable by writing past the
 * input's `maxlength` — could block the main thread for tens of seconds, which
 * a user experiences as a hung tab rather than a slow one.
 *
 * The walk now starts at the longest run that could possibly fit, so these
 * tests pin both halves of that claim: the cost no longer tracks the input
 * length, and the output is unchanged by the new starting point.
 */
describe('oversized labels', () => {
  const HUGE = 'a'.repeat(50_000);

  it('fits a 50k-character label in well under a second', () => {
    const started = Date.now();
    buildWheel([HUGE, 'Sushi']);
    // The pre-fix walk took ~30s at 20k characters and did not finish at 100k.
    // A second is generous for the bounded version and still nowhere near it.
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('keeps the rendered label inside the radial budget', () => {
    const svg = buildWheel([HUGE, 'Sushi']);
    const node = texts(svg)[0];
    const size = Number((node.getAttribute('font-size') ?? '').replace('px', ''));
    expect(estimateLabelWidth(node.textContent ?? '', size)).toBeLessThanOrEqual(122);
    expect(node.textContent).toMatch(/…$/u);
  });

  it('renders the same text as a label long enough to be cut anyway', () => {
    // Both are far past what fits, so bounding the walk must not change where
    // the cut lands.
    const short = buildWheel(['a'.repeat(120), 'Sushi']);
    const long = buildWheel([HUGE, 'Sushi']);
    expect(texts(long)[0].textContent).toBe(texts(short)[0].textContent);
  });

  it('never leaves a character narrower than the bound the walk relies on', () => {
    // The starting point is derived from MIN_CHAR_WIDTH, so a character that
    // measured under it could fit more than the walk ever considers, and the
    // label would be cut short for no reason.
    const sample =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;'!|`()[]{}/\\-@%…";
    for (const ch of sample) {
      expect(estimateLabelWidth(ch, 1)).toBeGreaterThanOrEqual(MIN_CHAR_WIDTH);
    }
  });
});

describe('variable slice counts', () => {
  it('accepts every count from 2 to 12', () => {
    for (let n = MIN_SLICES; n <= MAX_SLICES; n += 1) {
      const svg = buildWheel(labelsOfLength(n));
      expect(svg.querySelectorAll('path')).toHaveLength(n);
      expect(texts(svg)).toHaveLength(n);
    }
  });

  it('divides the full circle evenly however many slices there are', () => {
    for (const n of [2, 3, 5, 7, 12]) {
      const svg = buildWheel(labelsOfLength(n));
      const bisectors = texts(svg).map((node) => {
        const match = /rotate\((-?[\d.]+)/.exec(node.getAttribute('transform') ?? '');
        return Number(match?.[1]);
      });

      // First bisector is half a slice past 12 o'clock, and each subsequent
      // one is exactly one slice further round. Angles are serialised rounded
      // to 3 decimals, so a single angle carries up to 0.0005 of error and the
      // difference of two carries up to 0.001.
      const step = 360 / n;
      expect(Math.abs(bisectors[0] - (-90 + step / 2))).toBeLessThanOrEqual(0.0005);
      for (let i = 1; i < n; i += 1) {
        expect(Math.abs(bisectors[i] - bisectors[i - 1] - step)).toBeLessThanOrEqual(0.001);
      }
    }
  });

  it('sets the large-arc flag only when a slice exceeds a semicircle', () => {
    // Two slices are 180deg each; three are 120deg.
    const halves = Array.from(buildWheel(labelsOfLength(2)).querySelectorAll('path'));
    for (const path of halves) {
      expect(path.getAttribute('d')).toContain('A 180 180 0 0 1');
    }

    const thirds = Array.from(buildWheel(labelsOfLength(3)).querySelectorAll('path'));
    for (const path of thirds) {
      expect(path.getAttribute('d')).toContain('A 180 180 0 0 1');
    }
  });

  it('still starts slice 0 at 12 o-clock at every count', () => {
    for (const n of [2, 3, 6, 9, 12]) {
      const paths = Array.from(buildWheel(labelsOfLength(n)).querySelectorAll('path'));
      expect(paths[0].getAttribute('d')).toContain('L 200 20');
    }
  });

  it('does not hand wider slices a bigger label budget', () => {
    // The trap this guards: slices getting wider looks like more room, but a
    // label runs hub-to-rim, and that distance is identical at every count.
    // Three fat slices at a larger font must therefore fit *fewer* characters,
    // not more.
    const long = 'Abcdefghijklmnopqrstuvwx';
    const three = buildWheel(Array.from({ length: 3 }, () => long));
    const twelve = buildWheel(Array.from({ length: 12 }, () => long));

    const chars = (svg: SVGSVGElement) => (texts(svg)[0].textContent ?? '').length;
    expect(chars(three)).toBeLessThan(chars(twelve));
  });

  it('keeps one font size across all slices at every count', () => {
    for (const n of [2, 4, 8, 11]) {
      const svg = buildWheel(labelsOfLength(n));
      const sizes = new Set(texts(svg).map((node) => node.getAttribute('font-size')));
      expect(sizes.size).toBe(1);
    }
  });

  it('pairs every slice fill with its own ink colour token', () => {
    const svg = buildWheel(labelsOfLength(12));
    const paths = Array.from(svg.querySelectorAll('path'));
    paths.forEach((path, i) => {
      expect(path.getAttribute('fill')).toBe(`var(--slice-${i + 1})`);
    });
    texts(svg).forEach((node, i) => {
      expect(node.getAttribute('fill')).toBe(`var(--slice-ink-${i + 1})`);
    });
  });
});
