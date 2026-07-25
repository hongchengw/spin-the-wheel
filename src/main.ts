import './style.css';
import { renderSetupPanel, clearFields } from './form';

const setupPanel = document.querySelector<HTMLElement>('#setup-panel');

if (!setupPanel) {
  throw new Error('Missing #setup-panel element in index.html');
}

renderSetupPanel(setupPanel);

// `pageshow` fires on fresh loads *and* on bfcache restores, so this wipes
// anything form-state restoration tried to bring back across a reload.
window.addEventListener('pageshow', () => {
  clearFields(setupPanel);
});
