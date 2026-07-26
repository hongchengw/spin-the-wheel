import { describe, it, expect, beforeEach } from 'vitest';
import {
  renderSetupPanel,
  readLabels,
  clearFields,
  duplicateIndices,
  duplicateNotice,
  optionCount,
  DEFAULT_OPTION_COUNT,
  MIN_OPTION_COUNT,
  MAX_OPTION_COUNT,
} from '../src/form';
import { MAX_LABEL_CHARS } from '../src/wheel';

function addButton(root: ParentNode): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>('#add-option');
  if (!button) throw new Error('missing #add-option');
  return button;
}

function removeButtons(root: ParentNode): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('.field__remove'));
}

function click(el: HTMLElement): void {
  el.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
}

function setValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

let host: HTMLElement;

function inputs(root: ParentNode): HTMLInputElement[] {
  return Array.from(root.querySelectorAll('input'));
}

function fill(root: ParentNode, values: string[]): void {
  values.forEach((value, i) => {
    const input = root.querySelector<HTMLInputElement>(`#opt-${i + 1}`);
    if (!input) throw new Error(`missing #opt-${i + 1}`);
    input.value = value;
  });
}

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

/** `Option 1` … `Option n`, the fallback labels a blank form reads back as. */
function defaults(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `Option ${i + 1}`);
}

/** `opt-1` … `opt-n`, in the order the rows should carry them. */
function ids(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `opt-${i + 1}`);
}

/**
 * Renders the panel and grows it to `count` rows. The form opens at two, so
 * any test working with a longer list has to add the rows it needs first.
 */
function renderWithRows(root: HTMLElement, count: number): void {
  renderSetupPanel(root);
  while (optionCount(root) < count) click(addButton(root));
}

beforeEach(() => {
  host = document.createElement('div');
});

describe('renderSetupPanel', () => {
  it('renders exactly the default number of text inputs', () => {
    renderSetupPanel(host);
    const fields = inputs(host);
    expect(fields).toHaveLength(DEFAULT_OPTION_COUNT);
    for (const field of fields) {
      expect(field.type).toBe('text');
    }
  });

  it('gives the inputs ids opt-1 upward in order', () => {
    renderSetupPanel(host);
    expect(inputs(host).map((f) => f.id)).toEqual(ids(DEFAULT_OPTION_COUNT));
  });

  it('sets autocomplete="off" and maxlength="24" on every input', () => {
    renderSetupPanel(host);
    for (const field of inputs(host)) {
      expect(field.getAttribute('autocomplete')).toBe('off');
      expect(field.getAttribute('maxlength')).toBe('24');
    }
  });

  it('renders a form with id="options-form" and autocomplete="off"', () => {
    renderSetupPanel(host);
    const forms = Array.from(host.querySelectorAll('form'));
    expect(forms).toHaveLength(1);
    expect(forms[0].id).toBe('options-form');
    expect(forms[0].getAttribute('autocomplete')).toBe('off');
  });

  it('uses Option N placeholders, one per row', () => {
    renderSetupPanel(host);
    expect(inputs(host).map((f) => f.getAttribute('placeholder'))).toEqual(
      defaults(DEFAULT_OPTION_COUNT),
    );
  });

  it('associates a label with each input via a matching for attribute', () => {
    renderSetupPanel(host);
    const labels = Array.from(host.querySelectorAll('label'));
    expect(labels).toHaveLength(DEFAULT_OPTION_COUNT);
    for (const field of inputs(host)) {
      const label = labels.find((l) => l.getAttribute('for') === field.id);
      expect(label).toBeDefined();
      expect(label!.textContent).toBe(`Option ${field.id.slice(4)}`);
    }
  });

  it('renders a submit button with id="spin-btn" and text Spin', () => {
    renderSetupPanel(host);
    const button = host.querySelector<HTMLButtonElement>('#spin-btn');
    expect(button).not.toBeNull();
    expect(button!.tagName.toLowerCase()).toBe('button');
    expect(button!.type).toBe('submit');
    expect(button!.textContent).toBe('Spin');
  });

  it('is idempotent — calling it twice still yields the default row count', () => {
    renderSetupPanel(host);
    renderSetupPanel(host);
    expect(inputs(host)).toHaveLength(DEFAULT_OPTION_COUNT);
    expect(host.querySelectorAll('form')).toHaveLength(1);
  });
});

describe('readLabels', () => {
  it('returns the typed values in order', () => {
    renderWithRows(host, TYPED.length);
    fill(host, TYPED);
    expect(readLabels(host)).toEqual(TYPED);
  });

  it('trims surrounding whitespace', () => {
    renderWithRows(host, TYPED.length);
    fill(host, ['  Pizza  ', ...TYPED.slice(1)]);
    expect(readLabels(host)[0]).toBe('Pizza');
  });

  it('falls back to Option N for blank fields', () => {
    renderWithRows(host, TYPED.length);
    const values = [...TYPED];
    values[1] = '';
    values[4] = '';
    fill(host, values);
    expect(readLabels(host)).toEqual([
      'Pizza',
      'Option 2',
      'Tacos',
      'Ramen',
      'Option 5',
      'Salad',
      'Burger',
      'Pasta',
    ]);
  });

  it('falls back to Option N for whitespace-only fields', () => {
    renderWithRows(host, TYPED.length);
    const values = [...TYPED];
    values[2] = '   ';
    fill(host, values);
    expect(readLabels(host)[2]).toBe('Option 3');
  });

  it('returns an Option N per row for a fully blank form', () => {
    renderSetupPanel(host);
    expect(readLabels(host)).toEqual(defaults(DEFAULT_OPTION_COUNT));
  });

  it('always returns one item per row, typed or not', () => {
    renderSetupPanel(host);
    expect(readLabels(host)).toHaveLength(DEFAULT_OPTION_COUNT);
    fill(host, TYPED.slice(0, DEFAULT_OPTION_COUNT));
    expect(readLabels(host)).toHaveLength(DEFAULT_OPTION_COUNT);
  });

  /**
   * `maxlength` is the visible cap, but it only governs typing and pasting.
   * Anything writing `value` directly — devtools, an extension, an autofill
   * path — sails past it, and every consumer downstream is sized by the string
   * it gets handed. The cap has to hold in code too.
   */
  describe('length cap', () => {
    it('caps a value written past the maxlength attribute', () => {
      renderSetupPanel(host);
      inputs(host)[0].value = 'x'.repeat(5000);
      expect(readLabels(host)[0]).toHaveLength(MAX_LABEL_CHARS);
    });

    it('leaves a value inside the cap untouched', () => {
      renderSetupPanel(host);
      const exact = 'y'.repeat(MAX_LABEL_CHARS);
      inputs(host)[0].value = exact;
      expect(readLabels(host)[0]).toBe(exact);
    });

    it('counts code points, so a cut never splits an emoji', () => {
      renderSetupPanel(host);
      // Each of these is a surrogate pair: a UTF-16 slice at the cap would
      // halve one and leave an unpaired code unit behind.
      inputs(host)[0].value = '🎡'.repeat(MAX_LABEL_CHARS + 10);
      const label = readLabels(host)[0];

      expect(Array.from(label)).toHaveLength(MAX_LABEL_CHARS);
      expect(label).not.toMatch(/[\uD800-\uDFFF]/u);
    });
  });
});

describe('clearFields', () => {
  it('empties every input', () => {
    renderWithRows(host, TYPED.length);
    fill(host, TYPED);
    expect(inputs(host).every((f) => f.value !== '')).toBe(true);
    clearFields(host);
    expect(inputs(host).map((f) => f.value)).toEqual(
      Array.from({ length: DEFAULT_OPTION_COUNT }, () => ''),
    );
  });

  it('also resets an edited row count, so a reload wipes that too', () => {
    renderWithRows(host, 10);
    expect(optionCount(host)).toBe(10);

    clearFields(host);

    expect(optionCount(host)).toBe(DEFAULT_OPTION_COUNT);
    expect(inputs(host).every((f) => f.value === '')).toBe(true);
  });
});

describe('adding and removing options', () => {
  it('starts at the default row count', () => {
    renderSetupPanel(host);
    expect(optionCount(host)).toBe(DEFAULT_OPTION_COUNT);
  });

  it('appends a row, renumbering ids contiguously', () => {
    renderSetupPanel(host);
    click(addButton(host));

    expect(optionCount(host)).toBe(3);
    expect(inputs(host).map((f) => f.id)).toEqual(ids(3));
  });

  it('preserves what was already typed when a row is added', () => {
    renderWithRows(host, TYPED.length);
    fill(host, TYPED);
    click(addButton(host));

    expect(inputs(host).map((f) => f.value)).toEqual([...TYPED, '']);
  });

  it('removes the chosen row and closes the gap', () => {
    renderWithRows(host, TYPED.length);
    fill(host, TYPED);

    click(removeButtons(host)[2]); // drop "Tacos"

    expect(optionCount(host)).toBe(7);
    expect(inputs(host).map((f) => f.value)).toEqual([
      'Pizza', 'Sushi', 'Ramen', 'Curry', 'Salad', 'Burger', 'Pasta',
    ]);
    expect(inputs(host).map((f) => f.id)).toEqual(ids(7));
  });

  it('stops at the 12 option ceiling and hides the add control there', () => {
    renderSetupPanel(host);
    // One click per possible row: the surplus must be absorbed, not stack up.
    for (let i = 0; i < MAX_OPTION_COUNT; i += 1) click(addButton(host));

    expect(optionCount(host)).toBe(MAX_OPTION_COUNT);
    expect(addButton(host).hidden).toBe(true);
  });

  it('hides the remove controls on a fresh form, which opens at the floor', () => {
    renderSetupPanel(host);

    expect(optionCount(host)).toBe(MIN_OPTION_COUNT);
    expect(removeButtons(host).every((b) => b.hidden)).toBe(true);
  });

  it('offers remove again as soon as a row is added', () => {
    renderSetupPanel(host);
    click(addButton(host));

    expect(removeButtons(host).every((b) => !b.hidden)).toBe(true);
  });

  it('stops at the 2 option floor and hides the remove controls there', () => {
    renderWithRows(host, MAX_OPTION_COUNT);
    for (let i = 0; i < MAX_OPTION_COUNT; i += 1) {
      const buttons = removeButtons(host).filter((b) => !b.hidden);
      if (buttons.length === 0) break;
      click(buttons[0]);
    }

    expect(optionCount(host)).toBe(MIN_OPTION_COUNT);
    expect(removeButtons(host).every((b) => b.hidden)).toBe(true);
  });

  it('keeps readLabels in step with the current row count', () => {
    renderSetupPanel(host);
    click(addButton(host));
    click(addButton(host));

    const labels = readLabels(host);
    expect(labels).toHaveLength(4);
    expect(labels[3]).toBe('Option 4');
  });

  it('reports the count to the user', () => {
    renderSetupPanel(host);
    expect(host.querySelector('#option-count')?.textContent).toBe('2 of 12 options');
    click(addButton(host));
    expect(host.querySelector('#option-count')?.textContent).toBe('3 of 12 options');
  });
});

describe('duplicateIndices', () => {
  it('finds nothing in a list of distinct values', () => {
    expect(duplicateIndices(TYPED)).toEqual([]);
  });

  it('flags every index sharing a repeated value', () => {
    expect(duplicateIndices(['Pizza', 'Sushi', 'Pizza'])).toEqual([0, 2]);
  });

  it('compares trimmed and case-insensitively', () => {
    expect(duplicateIndices(['Pizza', '  pizza  '])).toEqual([0, 1]);
  });

  it('does not treat blank fields as duplicates of each other', () => {
    expect(duplicateIndices(['', '', '   '])).toEqual([]);
  });

  it('handles more than one repeated value at once', () => {
    expect(duplicateIndices(['a', 'b', 'a', 'b', 'c'])).toEqual([0, 1, 2, 3]);
  });
});

describe('duplicateNotice', () => {
  it('is empty when nothing repeats', () => {
    expect(duplicateNotice(TYPED)).toBe('');
  });

  it('names a single repeated value and stays advisory', () => {
    const notice = duplicateNotice(['Pizza', 'Pizza', 'Sushi']);
    expect(notice).toContain('"Pizza"');
    expect(notice).toContain('appears more than once');
    expect(notice).toContain('own slice');
  });

  it('lists several repeated values', () => {
    const notice = duplicateNotice(['a', 'b', 'a', 'b']);
    expect(notice).toContain('"a"');
    expect(notice).toContain('"b"');
    expect(notice).toContain('appear more than once');
  });
});

describe('duplicate marking in the DOM', () => {
  it('marks matching inputs and writes the notice as the user types', () => {
    // Three rows, so an untouched third field can stand as the control.
    renderWithRows(host, 3);
    const fields = inputs(host);

    setValue(fields[0], 'Pizza');
    setValue(fields[1], 'pizza');

    expect(fields[0].classList.contains('is-duplicate')).toBe(true);
    expect(fields[1].classList.contains('is-duplicate')).toBe(true);
    expect(fields[2].classList.contains('is-duplicate')).toBe(false);
    expect(host.querySelector('#duplicate-notice')?.textContent).toContain('"Pizza"');
  });

  it('clears the marking once the clash is resolved', () => {
    renderSetupPanel(host);
    const fields = inputs(host);

    setValue(fields[0], 'Pizza');
    setValue(fields[1], 'Pizza');
    setValue(fields[1], 'Sushi');

    expect(inputs(host).some((f) => f.classList.contains('is-duplicate'))).toBe(false);
    expect(host.querySelector('#duplicate-notice')?.textContent).toBe('');
  });

  it('never blocks the spin button over a duplicate', () => {
    renderSetupPanel(host);
    const fields = inputs(host);
    setValue(fields[0], 'Pizza');
    setValue(fields[1], 'Pizza');

    const spin = host.querySelector<HTMLButtonElement>('#spin-btn');
    expect(spin?.disabled).toBe(false);
  });
});

describe('Enter walks down the fields', () => {
  function pressEnter(input: HTMLInputElement): boolean {
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(event);
    return event.defaultPrevented;
  }

  it('moves focus to the next field and suppresses the submit', () => {
    document.body.append(host);
    renderSetupPanel(host);
    const fields = inputs(host);

    fields[0].focus();
    const prevented = pressEnter(fields[0]);

    expect(prevented).toBe(true);
    expect(document.activeElement).toBe(fields[1]);
    host.remove();
  });

  it('leaves the last field alone so Enter still submits there', () => {
    document.body.append(host);
    renderSetupPanel(host);
    const fields = inputs(host);

    const prevented = pressEnter(fields[fields.length - 1]);

    expect(prevented).toBe(false);
    host.remove();
  });
});
