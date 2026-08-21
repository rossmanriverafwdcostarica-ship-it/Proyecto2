export function sanitizePhone(value) {
  const raw = String(value || '');
  const plus = raw.trim().startsWith('+') ? '+' : '';
  return plus + raw.replace(/\D/g, '');
}
