export const OPTION_COUNT = 8;

function fieldId(n: number): string {
  return `opt-${n}`;
}

function defaultLabel(n: number): string {
  return `Option ${n}`;
}

function fieldAt(root: ParentNode, n: number): HTMLInputElement | null {
  return root.querySelector<HTMLInputElement>(`#${fieldId(n)}`);
}

/**
 * Replaces the host's contents with the setup form: eight labelled text
 * fields plus the Spin submit button. Safe to call more than once.
 */
export function renderSetupPanel(host: HTMLElement): void {
  host.replaceChildren();

  const form = document.createElement('form');
  form.id = 'options-form';
  form.setAttribute('autocomplete', 'off');
  form.className = 'options-form';
  form.noValidate = true;

  const fields = document.createElement('div');
  fields.className = 'fields';

  for (let n = 1; n <= OPTION_COUNT; n += 1) {
    const group = document.createElement('div');
    group.className = 'field';

    const label = document.createElement('label');
    label.setAttribute('for', fieldId(n));
    label.textContent = defaultLabel(n);

    const input = document.createElement('input');
    input.type = 'text';
    input.id = fieldId(n);
    input.name = fieldId(n);
    input.placeholder = defaultLabel(n);
    input.setAttribute('maxlength', '24');
    input.setAttribute('autocomplete', 'off');

    group.append(label, input);
    fields.append(group);
  }

  const button = document.createElement('button');
  button.type = 'submit';
  button.id = 'spin-btn';
  button.textContent = 'Spin';

  form.append(fields, button);

  // The spin transition lands in a later task; for now just keep the page
  // from navigating on submit.
  form.addEventListener('submit', (event) => {
    event.preventDefault();
  });

  host.append(form);
}

/**
 * Reads the eight option fields from `root`, trimming each value and falling
 * back to `Option N` for anything blank. Always returns exactly 8 strings.
 */
export function readLabels(root: ParentNode): string[] {
  const labels: string[] = [];

  for (let n = 1; n <= OPTION_COUNT; n += 1) {
    const value = fieldAt(root, n)?.value.trim() ?? '';
    labels.push(value === '' ? defaultLabel(n) : value);
  }

  return labels;
}

/**
 * Empties every option field. Used on `pageshow` so neither form-state
 * restoration nor the bfcache can carry typing across a reload.
 */
export function clearFields(root: ParentNode): void {
  for (let n = 1; n <= OPTION_COUNT; n += 1) {
    const input = fieldAt(root, n);
    if (input) {
      input.value = '';
    }
  }
}
