/**
 * The copy behind the fake stop button.
 *
 * Pure and stateless: the caller owns the click counter, this only maps a
 * count to a line. Keeping it DOM-free is what makes the exact wording
 * testable without touching the app.
 *
 * The joke is the shape of the sequence — five escalating reassurances that
 * sound like a wheel genuinely winding down, then a flat refusal that never
 * softens again. It deliberately does not cycle: a loop would read as a
 * rotating list of flavour text, whereas a permanent `No.` reads as the app
 * dropping the act.
 *
 * The ellipsis is U+2026 and the dash in taunt 4 is U+2014. Both are asserted
 * character-by-character in tests/taunts.test.ts, so an editor that
 * "helpfully" rewrites them to `...` or `-` fails the suite rather than
 * quietly degrading the copy.
 */

const TAUNTS: readonly string[] = [
  'Slowing down…',
  'Almost there…',
  'Just one more rotation.',
  'Hold on — recalibrating.',
  'Nearly stopped now.',
];

const FINAL = 'No.';

/**
 * @param clickCount 1-based click index — the first click passes `1`.
 * @returns the line to show for that click; `No.` for anything past the fifth.
 * @throws RangeError if `clickCount` is below 1.
 *
 * Out-of-range input throws rather than clamping: there is no such thing as a
 * zeroth click, so a 0 or negative value means the caller's counter is wrong,
 * and silently returning the first taunt would hide that bug behind
 * plausible-looking output.
 */
export function tauntFor(clickCount: number): string {
  if (!Number.isFinite(clickCount) || clickCount < 1) {
    throw new RangeError(`clickCount must be >= 1, received ${clickCount}`);
  }
  const index = Math.floor(clickCount) - 1;
  return index < TAUNTS.length ? TAUNTS[index] : FINAL;
}
