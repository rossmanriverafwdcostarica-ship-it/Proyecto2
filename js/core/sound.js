let enabled = true;

export function setSoundEnabled(value) {
  enabled = value !== false;
}

export function isSoundEnabled() {
  return enabled;
}

export function playSound(name = 'click') {
  if (!enabled) return;

  const audio = new Audio(`./assets/audio/${name}.wav`);
  audio.volume = 0.28;
  audio.play().catch(error => {
    console.debug('[ZoFranca CR - audio]', error?.message || error);
  });
}
