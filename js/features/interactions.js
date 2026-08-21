import { $ } from '../core/dom.js';
import { playSound } from '../core/sound.js';

let toastObserverStarted = false;
let nextToastSound = null;

export function queueToastSound(sound = null) {
  nextToastSound = sound;
}

export function setupSoundsAndAnimations() {
  document.addEventListener('click', event => {
    if (event.target.closest('.btn,.nav-item,.support-card,.topbar-user,.tool-tab')) {
      playSound('click');
    }
  });

  if (toastObserverStarted) return;
  toastObserverStarted = true;

  const toast = $('#toast');
  if (!toast) return;

  new MutationObserver(() => {
    if (toast.classList.contains('hidden')) return;

    const type = toast.classList.contains('error') ? 'error' : 'success';
    const sound = nextToastSound || type;
    nextToastSound = null;
    playSound(sound);

    const workspace = $('.workspace');
    if (!workspace) return;

    workspace.classList.remove('action-create', 'action-update');
    void workspace.offsetWidth;
    workspace.classList.add(type === 'success' ? 'action-create' : 'action-update');
    setTimeout(() => workspace.classList.remove('action-create', 'action-update'), 600);
  }).observe(toast, { attributes: true, childList: true, subtree: true });
}
