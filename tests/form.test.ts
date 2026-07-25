import { describe, it, expect, beforeEach } from 'vitest';
import { renderSetupPanel, readLabels, clearFields } from '../src/form';

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
});
