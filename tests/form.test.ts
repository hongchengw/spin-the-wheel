import { describe, it, expect, beforeEach } from 'vitest';
import {
  renderSetupPanel,
  readLabels,
  clearFields,
  duplicateIndices,
  duplicateNotice,
  optionCount,
  MIN_OPTION_COUNT,
  MAX_OPTION_COUNT,
} from '../src/form';

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

beforeEach(() => {
  host = document.createElement('div');
});

describe('renderSetupPanel', () => {
  it('renders exactly 8 text inputs', () => {
    renderSetupPanel(host);
    const fields = inputs(host);
    expect(fields).toHaveLength(8);
    for (const field of fields) {
      expect(field.type).toBe('text');
    }
  });

  it('gives the inputs ids opt-1 through opt-8 in order', () => {
    renderSetupPanel(host);
    expect(inputs(host).map((f) => f.id)).toEqual([
      'opt-1',
      'opt-2',
      'opt-3',
      'opt-4',
      'opt-5',
      'opt-6',
      'opt-7',
      'opt-8',
    ]);
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

  it('uses placeholders Option 1 through Option 8', () => {
    renderSetupPanel(host);
    expect(inputs(host).map((f) => f.getAttribute('placeholder'))).toEqual([
      'Option 1',
      'Option 2',
      'Option 3',
      'Option 4',
      'Option 5',
      'Option 6',
      'Option 7',
      'Option 8',
    ]);
  });

  it('associates a label with each input via a matching for attribute', () => {
    renderSetupPanel(host);
    const labels = Array.from(host.querySelectorAll('label'));
    expect(labels).toHaveLength(8);
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

  it('is idempotent — calling it twice still yields exactly 8 inputs', () => {
    renderSetupPanel(host);
    renderSetupPanel(host);
    expect(inputs(host)).toHaveLength(8);
    expect(host.querySelectorAll('form')).toHaveLength(1);
  });
});

describe('readLabels', () => {
  it('returns the typed values in order', () => {
    renderSetupPanel(host);
    fill(host, TYPED);
    expect(readLabels(host)).toEqual(TYPED);
  });

  it('trims surrounding whitespace', () => {
    renderSetupPanel(host);
    fill(host, ['  Pizza  ', ...TYPED.slice(1)]);
    expect(readLabels(host)[0]).toBe('Pizza');
  });

  it('falls back to Option N for blank fields', () => {
    renderSetupPanel(host);
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
    renderSetupPanel(host);
    const values = [...TYPED];
    values[2] = '   ';
    fill(host, values);
    expect(readLabels(host)[2]).toBe('Option 3');
  });

  it('returns Option 1 through Option 8 for a fully blank form', () => {
    renderSetupPanel(host);
    expect(readLabels(host)).toEqual([
      'Option 1',
      'Option 2',
      'Option 3',
      'Option 4',
      'Option 5',
      'Option 6',
      'Option 7',
      'Option 8',
    ]);
  });

  it('always returns exactly 8 items', () => {
    renderSetupPanel(host);
    expect(readLabels(host)).toHaveLength(8);
    fill(host, TYPED);
    expect(readLabels(host)).toHaveLength(8);
  });
});

describe('clearFields', () => {
  it('empties every input', () => {
    renderSetupPanel(host);
    fill(host, TYPED);
    expect(inputs(host).every((f) => f.value !== '')).toBe(true);
    clearFields(host);
    expect(inputs(host).map((f) => f.value)).toEqual(['', '', '', '', '', '', '', '']);
  });

  it('also resets an edited row count, so a reload wipes that too', () => {
    renderSetupPanel(host);
    click(addButton(host));
    click(addButton(host));
    expect(optionCount(host)).toBe(10);

    clearFields(host);

    expect(optionCount(host)).toBe(8);
    expect(inputs(host).every((f) => f.value === '')).toBe(true);
  });
});

describe('adding and removing options', () => {
  it('starts at 8 rows', () => {
    renderSetupPanel(host);
    expect(optionCount(host)).toBe(8);
  });

  it('appends a row, renumbering ids contiguously', () => {
    renderSetupPanel(host);
    click(addButton(host));

    expect(optionCount(host)).toBe(9);
    expect(inputs(host).map((f) => f.id)).toEqual([
      'opt-1', 'opt-2', 'opt-3', 'opt-4', 'opt-5',
      'opt-6', 'opt-7', 'opt-8', 'opt-9',
    ]);
  });

  it('preserves what was already typed when a row is added', () => {
    renderSetupPanel(host);
    fill(host, TYPED);
    click(addButton(host));

    expect(inputs(host).map((f) => f.value)).toEqual([...TYPED, '']);
  });

  it('removes the chosen row and closes the gap', () => {
    renderSetupPanel(host);
    fill(host, TYPED);

    click(removeButtons(host)[2]); // drop "Tacos"

    expect(optionCount(host)).toBe(7);
    expect(inputs(host).map((f) => f.value)).toEqual([
      'Pizza', 'Sushi', 'Ramen', 'Curry', 'Salad', 'Burger', 'Pasta',
    ]);
    expect(inputs(host).map((f) => f.id)).toEqual([
      'opt-1', 'opt-2', 'opt-3', 'opt-4', 'opt-5', 'opt-6', 'opt-7',
    ]);
  });

  it('stops at the 12 option ceiling and hides the add control there', () => {
    renderSetupPanel(host);
    for (let i = 0; i < 10; i += 1) click(addButton(host));

    expect(optionCount(host)).toBe(MAX_OPTION_COUNT);
    expect(addButton(host).hidden).toBe(true);
  });

  it('stops at the 2 option floor and hides the remove controls there', () => {
    renderSetupPanel(host);
    for (let i = 0; i < 10; i += 1) {
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
    expect(labels).toHaveLength(10);
    expect(labels[9]).toBe('Option 10');
  });

  it('reports the count to the user', () => {
    renderSetupPanel(host);
    expect(host.querySelector('#option-count')?.textContent).toBe('8 of 12 options');
    click(addButton(host));
    expect(host.querySelector('#option-count')?.textContent).toBe('9 of 12 options');
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
    renderSetupPanel(host);
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
