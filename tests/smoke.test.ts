import { describe, it, expect } from 'vitest';

describe('test harness', () => {
  it('runs in a jsdom environment with a usable document', () => {
    const node = document.createElement('div');
    node.id = 'smoke-probe';
    node.textContent = 'Infinite Spin Trap';
    document.body.appendChild(node);

    const found = document.querySelector('#smoke-probe');
    expect(found).not.toBeNull();
    expect(found?.textContent).toBe('Infinite Spin Trap');

    found?.remove();
    expect(document.querySelector('#smoke-probe')).toBeNull();
  });
});
