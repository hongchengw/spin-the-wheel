import './style.css';

const setupPanel = document.querySelector<HTMLElement>('#setup-panel');

if (!setupPanel) {
  throw new Error('Missing #setup-panel element in index.html');
}
