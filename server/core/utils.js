import { createHash } from 'node:crypto';

export const hashPassword = value => createHash('sha256').update(String(value)).digest('hex');
export const now = () => new Date().toISOString();
export const sameId = (a, b) => String(a) === String(b);

export function normalizeId(id) {
  if (id === undefined || id === null || id === '') return id;
  const numeric = Number(id);
  return Number.isFinite(numeric) ? numeric : String(id);
}

export function nextId(items) {
  const ids = items.map(item => Number(item.id)).filter(Number.isFinite);
  return ids.length ? Math.max(...ids) + 1 : 1;
}
