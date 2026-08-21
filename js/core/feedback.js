import { $ } from './dom.js';

let toastTimer = null;

export function showLoading(show = true) {
  $('#loadingBar')?.classList.toggle('hidden', !show);
}

export function message(text, type = 'info') {
  const element = $('#globalMessage');
  if (!element) return;

  if (!text) {
    element.className = 'global-message hidden';
    element.textContent = '';
    return;
  }

  element.className = `global-message ${type}`;
  element.textContent = text;
}

export function toast(text, type = 'success') {
  const element = $('#toast');
  if (!element) return;

  clearTimeout(toastTimer);
  element.textContent = text;
  element.className = `toast ${type}`;
  toastTimer = setTimeout(() => element.classList.add('hidden'), 4200);
}
