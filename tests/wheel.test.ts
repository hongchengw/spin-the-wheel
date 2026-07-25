import { describe, it, expect } from 'vitest';
import { buildWheel } from '../src/wheel';

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

  it('leaves a 14 character label intact', () => {
    const label = 'FourteenCharas';
    expect(label).toHaveLength(14);
    const svg = buildWheel(labelsWith(0, label));
    expect(texts(svg)[0].textContent).toBe(label);
  });

  it('truncates a 15 character label to 13 characters plus an ellipsis', () => {
    const label = 'FifteenCharsXYZ';
    expect(label).toHaveLength(15);
    const svg = buildWheel(labelsWith(0, label));
    const rendered = texts(svg)[0].textContent ?? '';
    expect(rendered).toBe('FifteenCharsX…');
    expect(rendered).toHaveLength(14);
  });

  it('truncates a 24 character label to the same 14 character form', () => {
    const label = 'FifteenCharsXYZ123456789';
    expect(label).toHaveLength(24);
    const svg = buildWheel(labelsWith(0, label));
    const rendered = texts(svg)[0].textContent ?? '';
    expect(rendered).toBe('FifteenCharsX…');
    expect(rendered).toHaveLength(14);
  });

  it('uses 17px labels when every label is short', () => {
    const svg = buildWheel(SHORT_LABELS);
    for (const node of texts(svg)) {
      expect(node.getAttribute('font-size')).toBe('17px');
    }
  });

  it('steps every label down to 14px when one label is long', () => {
    const svg = buildWheel(labelsWith(3, 'ElevenChars'));
    const nodes = texts(svg);
    expect(nodes).toHaveLength(8);
    for (const node of nodes) {
      expect(node.getAttribute('font-size')).toBe('14px');
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

  it('throws when not given exactly 8 labels', () => {
    expect(() => buildWheel(SHORT_LABELS.slice(0, 7))).toThrow(Error);
    expect(() => buildWheel([...SHORT_LABELS, 'India'])).toThrow(Error);
  });
});
