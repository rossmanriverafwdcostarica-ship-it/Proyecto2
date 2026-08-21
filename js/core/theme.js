import { $ } from './dom.js';

export function applyTheme(theme) {
  const dark = theme === 'oscuro';
  document.body.classList.toggle('theme-dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';

  const toggle = $('#themeToggle');
  if (!toggle) return;

  toggle.textContent = dark ? '☀' : '◐';
  toggle.setAttribute('aria-label', dark ? 'Activar modo claro' : 'Activar modo oscuro');
  toggle.title = dark ? 'Modo claro' : 'Modo oscuro';
}
