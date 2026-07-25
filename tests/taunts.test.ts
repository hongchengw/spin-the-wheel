import { describe, it, expect } from 'vitest';
import { tauntFor } from '../src/taunts';

const ESCALATION = [
  'Slowing down…',
  'Almost there…',
  'Just one more rotation.',
  'Hold on — recalibrating.',
  'Nearly stopped now.',
];

describe('tauntFor', () => {
  it('returns the first taunt on click 1', () => {
    expect(tauntFor(1)).toBe('Slowing down…');
  });

  it('escalates through five exact strings for clicks 1-5', () => {
    ESCALATION.forEach((expected, i) => {
      expect(tauntFor(i + 1)).toBe(expected);
    });
  });

  it('collapses to No. on click 6', () => {
    expect(tauntFor(6)).toBe('No.');
  });

  it('never cycles back — 7, 50 and 1000 all stay at No.', () => {
    expect(tauntFor(7)).toBe('No.');
    expect(tauntFor(50)).toBe('No.');
    expect(tauntFor(1000)).toBe('No.');
  });

  it('uses U+2026 for the ellipsis, not three periods', () => {
    const first = tauntFor(1);
    expect(first).toHaveLength(13);
    expect(first.codePointAt(12)).toBe(0x2026);
    expect(first).not.toContain('...');

    const second = tauntFor(2);
    expect(second).toHaveLength(13);
    expect(second.codePointAt(12)).toBe(0x2026);
    expect(second).not.toContain('...');
  });

  it('uses U+2014 for the em dash on click 4', () => {
    const fourth = tauntFor(4);
    const dashIndex = fourth.indexOf('—');
    expect(dashIndex).toBeGreaterThan(-1);
    expect(fourth.codePointAt(dashIndex)).toBe(0x2014);
    expect(fourth).not.toContain('--');
    expect(fourth).not.toContain(' - ');
  });

  it('throws a RangeError for click counts below 1', () => {
    expect(() => tauntFor(0)).toThrow(RangeError);
    expect(() => tauntFor(-1)).toThrow(RangeError);
  });
});
