import { escapeHTML } from './dom.js';

const crNumber = new Intl.NumberFormat('es-CR');
const usdMoney = new Intl.NumberFormat('es-CR', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});
const crDate = new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium' });
const crDateTime = new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeStyle: 'short' });

export function money(value) {
  return usdMoney.format(Number(value) || 0);
}

export function number(value) {
  return crNumber.format(Number(value) || 0);
}

export function date(value) {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : crDate.format(parsed);
}

export function dateTime(value) {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : crDateTime.format(parsed);
}

export function badge(value) {
  const raw = String(value || 'Sin estado');
  const key = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');

  return `<span class="badge badge-${key}">${escapeHTML(raw)}</span>`;
}
