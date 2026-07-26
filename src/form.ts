/**
 * The setup form: the eight-ish text fields the user pours effort into.
 *
 * Everything here is driven off the DOM rather than a parallel state object.
 * The rows *are* the state, so there is nothing to keep in sync and nothing
 * that can survive a reload.
 */

import { MIN_SLICES, MAX_SLICES, sliceToken } from './wheel';

export const DEFAULT_OPTION_COUNT = 8;
export const MIN_OPTION_COUNT = MIN_SLICES;
export const MAX_OPTION_COUNT = MAX_SLICES;

const SVG_NS = 'http://www.w3.org/2000/svg';

function fieldId(n: number): string {
  return `opt-${n}`;
}

function defaultLabel(n: number): string {
  return `Option ${n}`;
}

function fieldAt(root: ParentNode, n: number): HTMLInputElement | null {
  return root.querySelector<HTMLInputElement>(`#${fieldId(n)}`);
}

/** Every option input currently in `root`, in document order. */
export function optionInputs(root: ParentNode): HTMLInputElement[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>('input[data-option]'));
}

export function optionCount(root: ParentNode): number {
  return optionInputs(root).length;
}

/**
 * Indices of every value that appears more than once, compared trimmed and
 * case-insensitively. Blanks are exempt: they are not duplicates of each
 * other, they are eight separate unfilled fields.
 *
 * Pure, so the rule is testable without a DOM.
 */
export function duplicateIndices(values: string[]): number[] {
  const seen = new Map<string, number[]>();

  values.forEach((value, index) => {
    const key = value.trim().toLowerCase();
    if (key === '') return;
    const group = seen.get(key);
    if (group) group.push(index);
    else seen.set(key, [index]);
  });

  const flagged: number[] = [];
  for (const group of seen.values()) {
    if (group.length > 1) flagged.push(...group);
  }
  return flagged.sort((a, b) => a - b);
}

/** The wording under the fields when duplicates exist; `''` when they do not. */
export function duplicateNotice(values: string[]): string {
  const flagged = duplicateIndices(values);
  if (flagged.length === 0) return '';

  const names = [...new Set(flagged.map((i) => values[i].trim()))];
  const list =
    names.length === 1
      ? `"${names[0]}"`
      : names
          .slice(0, -1)
          .map((n) => `"${n}"`)
          .join(', ') + ` and "${names[names.length - 1]}"`;

  return `${list} ${names.length === 1 ? 'appears' : 'appear'} more than once. Each entry still gets its own slice.`;
}

function icon(pathData: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', pathData);
  svg.appendChild(path);
  return svg;
}

function buildRow(n: number): HTMLLIElement {
  const row = document.createElement('li');
  row.className = 'field';

  // Shows the user which colour their option will land on before they commit.
  const swatch = document.createElement('span');
  swatch.className = 'field__swatch';
  swatch.setAttribute('aria-hidden', 'true');
  swatch.style.setProperty('--swatch', `var(--slice-${sliceToken(n - 1)})`);

  const body = document.createElement('div');
  body.className = 'field__body';

  const label = document.createElement('label');
  label.setAttribute('for', fieldId(n));
  label.textContent = defaultLabel(n);

  const input = document.createElement('input');
  input.type = 'text';
  input.id = fieldId(n);
  input.name = fieldId(n);
  input.placeholder = defaultLabel(n);
  input.dataset.option = String(n);
  input.setAttribute('maxlength', '24');
  input.setAttribute('autocomplete', 'off');

  body.append(label, input);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'field__remove';
  remove.dataset.remove = String(n);
  remove.setAttribute('aria-label', `Remove option ${n}`);
  remove.appendChild(icon('M4 4 L12 12 M12 4 L4 12'));

  row.append(swatch, body, remove);
  return row;
}

/** Rebuilds the row list to hold exactly `values.length` fields. */
function renderRows(list: HTMLElement, values: string[]): void {
  list.replaceChildren();
  values.forEach((value, i) => {
    const row = buildRow(i + 1);
    const input = row.querySelector('input');
    if (input) input.value = value;
    list.append(row);
  });
}

function currentValues(root: ParentNode): string[] {
  return optionInputs(root).map((input) => input.value);
}

/**
 * Reflects the row count into the controls: the counter copy, and whether
 * add/remove are still available. Remove is *hidden* rather than disabled at
 * the floor — a disabled control the user cannot explain is worse than no
 * control, and two options is a legitimate resting state.
 */
function syncControls(form: HTMLElement): void {
  const count = optionCount(form);

  const counter = form.querySelector<HTMLElement>('#option-count');
  if (counter) counter.textContent = `${count} of ${MAX_OPTION_COUNT} options`;

  const add = form.querySelector<HTMLButtonElement>('#add-option');
  if (add) add.hidden = count >= MAX_OPTION_COUNT;

  const atFloor = count <= MIN_OPTION_COUNT;
  for (const button of form.querySelectorAll<HTMLButtonElement>('.field__remove')) {
    button.hidden = atFloor;
  }
}

function syncDuplicates(form: HTMLElement): void {
  const values = currentValues(form);
  const flagged = new Set(duplicateIndices(values));

  optionInputs(form).forEach((input, i) => {
    input.classList.toggle('is-duplicate', flagged.has(i));
  });

  const notice = form.querySelector<HTMLElement>('#duplicate-notice');
  if (notice) notice.textContent = duplicateNotice(values);
}

function setRowCount(form: HTMLElement, values: string[]): void {
  const list = form.querySelector<HTMLElement>('#option-list');
  if (!list) return;
  renderRows(list, values);
  syncControls(form);
  syncDuplicates(form);
}

/**
 * Replaces the host's contents with the setup form. Safe to call more than
 * once.
 */
export function renderSetupPanel(host: HTMLElement): void {
  host.replaceChildren();

  const form = document.createElement('form');
  form.id = 'options-form';
  form.setAttribute('autocomplete', 'off');
  form.className = 'options-form';
  form.noValidate = true;

  const list = document.createElement('ul');
  list.id = 'option-list';
  list.className = 'fields';

  const notice = document.createElement('p');
  notice.id = 'duplicate-notice';
  notice.className = 'notice';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');

  const row = document.createElement('div');
  row.className = 'form-actions';

  const add = document.createElement('button');
  add.type = 'button';
  add.id = 'add-option';
  add.className = 'ghost-btn';
  add.appendChild(icon('M8 3 L8 13 M3 8 L13 8'));
  add.append(document.createTextNode('Add option'));

  const counter = document.createElement('p');
  counter.id = 'option-count';
  counter.className = 'counter';

  row.append(add, counter);

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.id = 'spin-btn';
  submit.className = 'primary-btn';
  submit.textContent = 'Spin';

  form.append(list, notice, row, submit);

  // --- behaviour -----------------------------------------------------------

  add.addEventListener('click', () => {
    const values = currentValues(form);
    if (values.length >= MAX_OPTION_COUNT) return;
    setRowCount(form, [...values, '']);
    fieldAt(form, values.length + 1)?.focus();
  });

  list.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('.field__remove');
    if (!button) return;

    const values = currentValues(form);
    if (values.length <= MIN_OPTION_COUNT) return;

    const index = Number(button.dataset.remove) - 1;
    const next = values.filter((_, i) => i !== index);
    setRowCount(form, next);
    // Land on the row that took the removed one's place, or the new last row.
    fieldAt(form, Math.min(index + 1, next.length))?.focus();
  });

  list.addEventListener('input', () => {
    syncDuplicates(form);
  });

  // Enter walks down the list instead of submitting, so a user filling the
  // form by keyboard cannot fire the one-way spin by accident halfway through.
  // The last field keeps the native submit, which is where Enter should work.
  list.addEventListener('keydown', (event) => {
    if (!(event instanceof KeyboardEvent) || event.key !== 'Enter') return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.dataset.option) return;

    const n = Number(target.dataset.option);
    const next = fieldAt(form, n + 1);
    if (!next) return;

    event.preventDefault();
    next.focus();
  });

  // The spin transition is wired in app.ts; this only stops navigation.
  form.addEventListener('submit', (event) => {
    event.preventDefault();
  });

  host.append(form);

  setRowCount(form, Array.from({ length: DEFAULT_OPTION_COUNT }, () => ''));
}

/**
 * Reads the option fields from `root`, trimming each value and falling back
 * to `Option N` for anything blank.
 */
export function readLabels(root: ParentNode): string[] {
  return optionInputs(root).map((input, i) => {
    const value = input.value.trim();
    return value === '' ? defaultLabel(i + 1) : value;
  });
}

/**
 * Wipes the form back to its opening state: default row count, every field
 * empty. Used on `pageshow`, so neither form-state restoration nor the
 * bfcache can carry typing — or an edited row count — across a reload.
 */
export function clearFields(root: ParentNode): void {
  const form = root.querySelector<HTMLElement>('#options-form');
  if (!form) {
    for (const input of optionInputs(root)) input.value = '';
    return;
  }
  setRowCount(form, Array.from({ length: DEFAULT_OPTION_COUNT }, () => ''));
}
